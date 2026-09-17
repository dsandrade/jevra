import { constants } from 'node:fs';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';
import { parseDocument } from 'yaml';
import { z } from 'zod';
import { DecisionError, hash } from '@jevra/core';
import type { Skill } from '@jevra/core';

const metadataSchema = z.object({
  name: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,95}$/),
  description: z.string().trim().min(1).max(2048),
});
export interface Catalog {
  skills: Skill[];
  coverage: 'configured-roots';
  diagnostics: { code: string; source: string }[];
}

export async function loadCatalog(roots: string[], maxSkills: number, signal?: AbortSignal): Promise<Catalog> {
  const found: Skill[] = [];
  const seen = new Set<string>();
  const diagnostics: Catalog['diagnostics'] = [];
  let visited = 0;
  const within = (root: string, path: string) => {
    const rel = relative(root, path);
    return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep));
  };
  for (const configuredRoot of roots) {
    signal?.throwIfAborted();
    let root: string;
    try { root = await realpath(configuredRoot); }
    catch { diagnostics.push({ code: 'root_unavailable', source: configuredRoot }); continue; }
    const walk = async (directory: string, depth: number): Promise<void> => {
      signal?.throwIfAborted();
      if (++visited > 1024) throw new DecisionError('budget_exceeded');
      const canonical = await realpath(directory);
      if (!within(root, canonical)) { diagnostics.push({ code: 'outside_root', source: directory }); return; }
      const entries = await readdir(canonical, { withFileTypes: true });
      if (entries.length > 1024) throw new DecisionError('budget_exceeded');
      entries.sort((a, b) => a.name.localeCompare(b.name));
      const isSkillDirectory = entries.some(entry => entry.name === 'SKILL.md');
      for (const entry of entries) {
        signal?.throwIfAborted();
        const path = join(canonical, entry.name);
        if (entry.isSymbolicLink()) {
          if (!isSkillDirectory || entry.name === 'SKILL.md') diagnostics.push({ code: 'symlink_skipped', source: path });
          continue;
        }
        if (!isSkillDirectory && entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          if (depth >= 4) { diagnostics.push({ code: 'depth_limit', source: path }); continue; }
          await walk(path, depth + 1);
        }
        if (entry.name !== 'SKILL.md' || !entry.isFile()) continue;
        if (seen.has(path)) continue;
        seen.add(path);
        try {
          const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
          let text: string;
          try {
            const info = await file.stat();
            if (!info.isFile() || info.size > 65536) throw new Error('size');
            // A bounded read protects against a file growing after stat().
            const buffer = Buffer.alloc(65537);
            const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
            if (bytesRead > 65536) throw new Error('size');
            text = buffer.subarray(0, bytesRead).toString('utf8');
          } finally { await file.close(); }
          const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
          if (!match?.[1]) throw new Error('metadata');
          const doc = parseDocument(match[1], { uniqueKeys: true, strict: true });
          if (doc.errors.length || doc.warnings.length) throw new Error('yaml');
          const metadata = metadataSchema.parse(doc.toJS({ maxAliasCount: 0 }));
          found.push({ id: 'skill_' + hash(path).slice(0, 16), ...metadata, path, contentHash: hash(text) });
          if (found.length > maxSkills) throw new DecisionError('budget_exceeded');
        } catch (error) {
          if (error instanceof DecisionError) throw error;
          diagnostics.push({ code: 'invalid_skill', source: path });
        }
      }
    };
    try {
      if (!(await lstat(root)).isDirectory()) throw new Error('not_directory');
      await walk(root, 0);
    } catch (error) {
      if (error instanceof DecisionError || signal?.aborted) throw error;
      diagnostics.push({ code: 'root_unreadable', source: configuredRoot });
    }
  }
  const counts = new Map<string, number>();
  for (const skill of found) counts.set(skill.name.toLowerCase(), (counts.get(skill.name.toLowerCase()) ?? 0) + 1);
  const skills = found.filter(skill => {
    if (counts.get(skill.name.toLowerCase()) === 1) return true;
    diagnostics.push({ code: 'duplicate_name', source: skill.path });
    return false;
  });
  return { skills: skills.sort((a, b) => a.name.localeCompare(b.name)), coverage: 'configured-roots', diagnostics };
}
