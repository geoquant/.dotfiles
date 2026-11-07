import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]

class PiPortabilityTests(unittest.TestCase):
    def test_manifest_covers_stack(self):
        manifest = (ROOT/'home/.config/agent-tooling/pi-packages.txt').read_text()
        self.assertIn('git:github.com/t3dotgg/tstack@1085050f', manifest)
        self.assertIn('../../.local/share/pstack-pi', manifest)
        package = ROOT/'home/.local/share/pstack-pi'
        self.assertEqual(len(list((package/'skills').glob('*/SKILL.md'))), 52)
        self.assertTrue((package/'LICENSE').is_file())
        self.assertFalse(list(package.rglob('node_modules')))
        self.assertTrue((ROOT/'home/.agents/skills/rex/SKILL.md').is_file())

    def test_bootstrap_preserves_auth_model_and_idempotence(self):
        with tempfile.TemporaryDirectory() as temp:
            home = Path(temp)
            defaults = home/'.local/share/agent-tooling'
            defaults.mkdir(parents=True)
            shutil.copy(ROOT/'home/.local/share/agent-tooling/pi-defaults.json', defaults)
            settings = home/'.pi/agent/settings.json'
            settings.parent.mkdir(parents=True)
            initial = {'defaultProvider':'synthetic', 'defaultModel':'synthetic-model', 'packages':['existing'], 'theme':'existing-theme'}
            settings.write_text(json.dumps(initial))
            run = lambda: subprocess.run([str(ROOT/'home/.local/bin/pi-settings-bootstrap')], env={**os.environ,'HOME':temp}, capture_output=True)
            self.assertEqual(run().returncode, 0)
            first = settings.read_text()
            self.assertEqual(run().returncode, 0)
            self.assertEqual(first, settings.read_text())
            merged=json.loads(first)
            for k,v in initial.items(): self.assertEqual(merged[k],v)
            self.assertEqual(merged['markdown']['mermaid'],'streaming')
            self.assertEqual(settings.stat().st_mode & 0o777,0o600)
            settings.write_text('[]')
            self.assertNotEqual(run().returncode,0)
            self.assertEqual(settings.read_text(),'[]')

if __name__ == '__main__': unittest.main()
