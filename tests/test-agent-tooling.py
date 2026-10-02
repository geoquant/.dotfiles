"""Public-entrypoint checks for owned clones, brain bootstrap and private history extraction."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

REPO = Path(__file__).resolve().parents[1]
CLONE = REPO / 'home/.local/bin/muster-worker-worktree'
TOOLING = REPO / 'home/.local/bin/agent-tooling'
EXTRACT = REPO / 'home/.agents/skills/ruminate/scripts/extract-conversations.py'


class AgentToolingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='agent-tooling-test-')
        self.root = Path(self.temp.name)
        self.env = {**os.environ, 'HOME': str(self.root), 'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_CONFIG_NOSYSTEM': '1'}
        self.source = self.root / 'source'
        self.source.mkdir()
        self.git(self.source, 'init', '-q', '-b', 'main')
        self.git(self.source, 'config', 'user.name', 'Synthetic Test')
        self.git(self.source, 'config', 'user.email', 'synthetic@example.test')
        (self.source / 'file.txt').write_text('base\n')
        self.git(self.source, 'add', '.')
        self.git(self.source, '-c', 'commit.gpgsign=false', 'commit', '-qm', 'base')

    def tearDown(self):
        self.temp.cleanup()

    def run_cli(self, *args):
        return subprocess.run([str(arg) for arg in args], env=self.env, text=True, capture_output=True)

    def git(self, cwd, *args):
        result = self.run_cli('git', '-C', cwd, *args)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout.strip()

    def create(self, slug='test-worker', base='main'):
        result = self.run_cli(CLONE, 'create', self.source, slug, '--base', base)
        self.assertEqual(result.returncode, 0, result.stderr)
        receipt = dict(line.split(': ', 1) for line in result.stdout.splitlines())
        clone = Path(receipt['worktree'])
        self.assertEqual(self.git(clone, 'rev-parse', 'HEAD'), self.git(self.source, 'rev-parse', base))
        self.assertIn(self.git(clone, 'rev-parse', 'HEAD'), receipt['base'])
        return clone

    def test_clone_remove_preserves_source(self):
        clone = self.create()
        result = self.run_cli(CLONE, 'remove', clone)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(clone.exists())
        self.assertTrue((self.source / 'file.txt').exists())

    def test_unharvested_and_dirty_work_survive(self):
        clone = self.create()
        (clone / 'file.txt').write_text('worker\n')
        self.assertNotEqual(self.run_cli(CLONE, 'remove', clone).returncode, 0)
        self.git(clone, 'config', 'user.name', 'Synthetic Test')
        self.git(clone, 'config', 'user.email', 'synthetic@example.test')
        self.git(clone, 'add', '.')
        self.git(clone, '-c', 'commit.gpgsign=false', 'commit', '-qm', 'worker')
        self.assertNotEqual(self.run_cli(CLONE, 'remove', clone).returncode, 0)
        branch = self.git(clone, 'symbolic-ref', '--short', 'HEAD')
        self.git(self.source, 'fetch', clone, f'{branch}:{branch}')
        self.assertEqual(self.run_cli(CLONE, 'remove', clone).returncode, 0)

    def test_ignored_work_and_symlink_remove_fail_closed(self):
        clone = self.create()
        (clone / '.git/info/exclude').write_text('private.env\n')
        (clone / 'private.env').write_text('SYNTHETIC=1\n')
        self.assertNotEqual(self.run_cli(CLONE, 'remove', clone).returncode, 0)
        alias = self.root / 'alias'
        alias.symlink_to(clone)
        self.assertNotEqual(self.run_cli(CLONE, 'remove', '--force', alias).returncode, 0)
        self.assertTrue(clone.exists())

    def test_invalid_base_and_unowned_remove_fail_closed(self):
        self.assertNotEqual(self.run_cli(CLONE, 'create', self.source, '../escape').returncode, 0)
        self.assertNotEqual(self.run_cli(CLONE, 'create', self.source, 'test', '--base', 'missing').returncode, 0)
        self.assertNotEqual(self.run_cli(CLONE, 'remove', '--force', self.source).returncode, 0)
        self.assertTrue(self.source.exists())

    def test_brain_bootstrap_is_explicit_and_non_overwriting(self):
        template = self.root / '.local/share/agent-tooling/brain-template'
        template.mkdir(parents=True)
        (template / 'index.md').write_text('# Synthetic brain\n')
        result = subprocess.run([str(TOOLING), 'brain-init'], cwd=self.root, env=self.env, capture_output=True)
        self.assertEqual(result.returncode, 0)
        second = subprocess.run([str(TOOLING), 'brain-init'], cwd=self.root, env=self.env, capture_output=True)
        self.assertNotEqual(second.returncode, 0)
        self.assertEqual((self.root / 'brain/index.md').read_text(), '# Synthetic brain\n')

    def test_pi_and_claude_history_excludes_tools_thinking_and_malformed_records(self):
        conversations = self.root / 'sessions'
        conversations.mkdir()
        records = [
            {'type': 'user', 'message': {'content': 'Synthetic Claude correction'}},
            {'type': 'message', 'message': {'role': 'user', 'content': [{'type': 'text', 'text': 'Synthetic Pi correction'}]}},
            {'type': 'message', 'message': {'role': 'assistant', 'content': [{'type': 'thinking', 'thinking': 'excluded thinking'}, {'type': 'text', 'text': 'Synthetic assistant response'}]}},
            {'type': 'message', 'message': {'role': 'toolResult', 'content': 'excluded tool result'}},
            [], {'type': 'assistant', 'message': {'content': [{'type': 'text', 'text': 123}]}},
        ]
        (conversations / 'synthetic.jsonl').write_text('\n'.join(json.dumps(record) for record in records)+'\ninvalid json\n')
        output = self.root / 'private-output'
        result = self.run_cli('python3', EXTRACT, conversations, output, '--min-size', '0', '--batches', '1')
        self.assertEqual(result.returncode, 0, result.stderr)
        text = next(output.glob('*.txt')).read_text()
        self.assertIn('Synthetic Claude correction', text)
        self.assertIn('Synthetic Pi correction', text)
        self.assertNotIn('excluded', text)
        self.assertEqual(output.stat().st_mode & 0o777, 0o700)
        self.assertEqual(next(output.glob('*.txt')).stat().st_mode & 0o777, 0o600)
        self.assertNotEqual(self.run_cli('python3', EXTRACT, conversations, output, '--batches', '0').returncode, 0)


if __name__ == '__main__':
    unittest.main()
