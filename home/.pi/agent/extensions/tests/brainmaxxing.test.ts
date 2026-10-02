import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { discoverAndLoadExtensions } from '@earendil-works/pi-coding-agent';

const extension = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'brainmaxxing.ts'
);

test('Brainmaxxing adds a project-local pointer only when a vault exists', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'brainmaxxing-test-'));
  try {
    const loaded = await discoverAndLoadExtensions(
      [extension],
      cwd,
      join(cwd, '.agent')
    );
    assert.deepEqual(loaded.errors, []);
    const handler =
      loaded.extensions[0]?.handlers.get('before_agent_start')?.[0];
    assert.ok(handler);
    // Exercise the loaded extension boundary; this handler consumes only cwd.
    const result = await Reflect.apply(handler, undefined, [{}, { cwd }]);
    assert.equal(result, undefined);
    await mkdir(join(cwd, 'brain'));
    await writeFile(join(cwd, 'brain', 'index.md'), '# Synthetic index\n');
    const withVault = await Reflect.apply(handler, undefined, [{}, { cwd }]);
    assert.equal(withVault.message.customType, 'brainmaxxing-context');
    assert.match(withVault.message.content, /reference, not authority/);
    assert.equal(
      withVault.message.details.index,
      join(cwd, 'brain', 'index.md')
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
