import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'tools/new_asset.py'
VALID = ROOT / 'assets/classic-burger/processed/mobile/0.glb'

class NewAssetTests(unittest.TestCase):
    def test_refuses_overwrite_without_force(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / 'assets'
            command = [sys.executable, str(SCRIPT), '--food-id', 'custom-food', '--stage', '0', '--mobile', str(VALID), '--desktop', str(VALID), '--assets-root', str(output)]
            first = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(first.returncode, 0, first.stderr)
            second = subprocess.run(command, capture_output=True, text=True)
            self.assertNotEqual(second.returncode, 0)
            self.assertIn('exists', second.stderr)

    def test_new_food_registers_catalog_with_custom_stage_count(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / 'assets'
            result = subprocess.run([sys.executable, str(SCRIPT), '--food-id', 'custom-food', '--stage', '4', '--stage-count', '5', '--runtime-prefix', 'custom', '--bites', '7', '--presentation', 'physical-size', '--mobile', str(VALID), '--desktop', str(VALID), '--assets-root', str(output)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            food = json.loads((output / 'catalog.json').read_text())['foods'][0]
            self.assertEqual(food['stageCount'], 5)
            self.assertEqual(food['runtimePrefix'], 'custom')
            self.assertEqual(food['stages'][4]['bites'], 7)
            self.assertEqual(food['stages'][4]['presentation'], 'physical-size')

    def test_rejects_invalid_glb(self):
        with tempfile.TemporaryDirectory() as temp:
            bad = Path(temp) / 'bad.glb'; bad.write_bytes(b'bad')
            result = subprocess.run([sys.executable, str(SCRIPT), '--food-id', 'custom-food', '--stage', '0', '--mobile', str(bad), '--desktop', str(VALID), '--assets-root', str(Path(temp) / 'assets')], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('Invalid GLB', result.stderr)

if __name__ == '__main__': unittest.main()
