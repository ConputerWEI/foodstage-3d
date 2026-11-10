import json
import struct
import tempfile
import unittest
from pathlib import Path
from assets import read_glb, sha256, dimensions_mm, verify, inventory, sync
import shutil

ROOT = Path(__file__).resolve().parents[1]

class AssetTests(unittest.TestCase):
    def test_runtime_catalog_has_mobile_and_desktop_for_every_food_stage(self):
        manifest = json.loads((ROOT / 'assets/manifest.json').read_text(encoding='utf-8'))
        catalog = json.loads((ROOT / 'assets/catalog.json').read_text(encoding='utf-8'))
        expected = {(food['id'], stage) for food in catalog['foods'] for stage in range(food['stageCount'])}
        self.assertEqual({(row['foodId'], row['stage']) for row in manifest['files']}, expected)
        self.assertEqual(len(manifest['files']), len(expected))
        self.assertTrue(all(set(row['variants']) == {'mobile', 'desktop'} for row in manifest['files']))

    def test_hash_and_dimensions_match_installed_runtime(self):
        path = ROOT / 'assets/classic-burger/processed/mobile/0.glb'
        runtime = ROOT / 'public/models-mobile/burger-0.glb'
        self.assertEqual(sha256(path), sha256(runtime))
        self.assertEqual(dimensions_mm(path), dimensions_mm(runtime))

    def test_glb_parser_rejects_invalid_file(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'invalid.glb'; path.write_bytes(b'no glb')
            with self.assertRaises(ValueError): read_glb(path)

    def test_glb_parser_rejects_zero_padded_json(self):
        # This JSON is 27 bytes, so one padding byte aligns its chunk.
        payload = b'{"asset":{"version":"2.0"}}'
        self.assertEqual(len(payload), 27)
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'zero-json.glb'
            for tail in (b'\0', b'\0    '):
                with self.subTest(tail=tail):
                    chunk = payload + tail
                    path.write_bytes(struct.pack('<4sII', b'glTF', 2, 28 + len(chunk))
                                     + struct.pack('<I4s', len(chunk), b'JSON') + chunk
                                     + struct.pack('<I4s', 0, b'BIN\0'))
                    with self.assertRaises(ValueError):
                        read_glb(path)

    def test_glb_parser_accepts_space_padded_json_and_zero_padded_bin(self):
        chunk = b'{"asset":{"version":"2.0"},"buffers":[{"byteLength":1}]}'
        chunk += b' ' * (-len(chunk) % 4)
        binary = b'\x7f\0\0\0'
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'valid.glb'
            path.write_bytes(struct.pack('<4sII', b'glTF', 2, 28 + len(chunk) + len(binary))
                             + struct.pack('<I4s', len(chunk), b'JSON') + chunk
                             + struct.pack('<I4s', len(binary), b'BIN\0') + binary)
            doc, blob = read_glb(path)
            self.assertEqual(doc['asset']['version'], '2.0')
            self.assertEqual(doc['buffers'], [{'byteLength': 1}])
            self.assertEqual(blob, b'\x7f\0\0\0')

    def test_dynamic_catalog_sync_restores_and_checks_runtime(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            asset_root = root / 'assets'
            asset_root.mkdir()
            catalog = {'schemaVersion': 1, 'foods': [{'id': 'new-food', 'runtimePrefix': 'special', 'stageCount': 1, 'stages': [{'bites': 3, 'calibration': {'scale': 1, 'position': [0, 0, 0], 'yaw': 0}}]}]}
            (asset_root / 'catalog.json').write_text(json.dumps(catalog))
            for variant in ('mobile', 'desktop'):
                target = asset_root / 'new-food/processed' / variant / '0.glb'
                target.parent.mkdir(parents=True)
                shutil.copyfile(ROOT / 'assets/classic-burger/processed/mobile/0.glb', target)
            source = asset_root / 'new-food/source/0.glb'
            source.parent.mkdir(parents=True)
            shutil.copyfile(ROOT / 'assets/classic-burger/processed/mobile/0.glb', source)
            manifest = inventory(root)
            self.assertEqual(manifest['files'][0]['foodId'], 'new-food')
            sync(manifest, root)
            runtime = root / 'public/models-mobile/special-0.glb'
            self.assertTrue(runtime.is_file())
            runtime.write_bytes(b'corrupted')
            with self.assertRaisesRegex(ValueError, 'Runtime hash mismatch'):
                verify(manifest, root)
            sync(manifest, root)
            verify(manifest, root)
            source.write_bytes(b'changed source')
            with self.assertRaisesRegex(ValueError, 'Source hash/size mismatch'):
                verify(manifest, root)
            shutil.copyfile(ROOT / 'assets/classic-burger/processed/mobile/0.glb', source)
            manifest['files'][0]['variants']['mobile']['path'] = '../outside.glb'
            with self.assertRaisesRegex(ValueError, 'Unsafe'):
                verify(manifest, root)

    def test_every_runtime_asset_path_exists(self):
        verify()

if __name__ == '__main__': unittest.main()
