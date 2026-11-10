import json
import tempfile
import unittest
from pathlib import Path
from assets import load_catalog


class StablePresentationTests(unittest.TestCase):
    def test_catalog_accepts_stable_source_origin_and_rejects_unknown_modes(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'catalog.json'
            stage = {'bites': 3, 'calibration': {'scale': 1, 'position': [0, 0, 0], 'yaw': 0}}
            catalog = {'schemaVersion': 1, 'foods': [{'id': 'chicken', 'runtimePrefix': 'chicken', 'stageCount': 1, 'stages': [stage]}]}
            for mode in ('physical-size-stable', 'not-a-presentation'):
                stage['presentation'] = mode
                path.write_text(json.dumps(catalog), encoding='utf-8')
                if mode == 'physical-size-stable':
                    self.assertEqual(load_catalog(catalog_path=path)['foods'][0]['stages'][0]['presentation'], mode)
                else:
                    with self.assertRaisesRegex(ValueError, 'Invalid stage presentation'):
                        load_catalog(catalog_path=path)
