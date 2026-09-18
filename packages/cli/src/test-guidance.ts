/** Shared closed-profile instructions. Parent and worker evaluations must expose the same grammar. */
export function testArtifactInstructions(sourceName: string, outputName: string, exportName: string): string[] {
  return [
    'Generate exactly one test file named ' + outputName + '. Return file content only.',
    'This profile supports only synchronous node:test cases with blocks of assert.equal or assert.strictEqual calls. '
      + 'Each assertion must directly call the imported target function with literal arguments and compare against a literal expected value. '
      + 'Use no variables, helpers, loops, nested suites, test options, async code, other imports or side effects.',
    'Import test from node:test, assert from node:assert/strict and { ' + exportName + ' } from ./'
      + sourceName + '. Each test takes a literal title and a zero-parameter callback.',
  ];
}
