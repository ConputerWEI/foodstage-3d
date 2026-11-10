import json
import struct
import tempfile
import unittest
from pathlib import Path
from tools.showcase_more_models import build_brownie_stage, build_drink_stage, read_glb_json

class ShowcaseMoreModelTests(unittest.TestCase):
    def test_generated_json_chunks_use_space_padding(self):
        padding_lengths = set()
        with tempfile.TemporaryDirectory() as td:
            for builder in (build_drink_stage, build_brownie_stage):
                for stage in range(4):
                    with self.subTest(builder=builder.__name__, stage=stage):
                        path = Path(td) / 'generated.glb'
                        builder(path, stage)
                        raw = path.read_bytes()
                        json_length, kind = struct.unpack_from('<I4s', raw, 12)
                        self.assertEqual(kind, b'JSON')
                        self.assertEqual(json_length % 4, 0)
                        text = raw[20:20 + json_length].decode('utf-8')
                        _, end = json.JSONDecoder().raw_decode(text)
                        padding = text[end:]
                        padding_lengths.add(len(padding))
                        self.assertEqual(padding, ' ' * (-end % 4))
        self.assertTrue(padding_lengths - {0}, 'Fixtures must exercise JSON padding')

    def test_drink_keeps_cup_and_changes_liquid_height(self):
        with tempfile.TemporaryDirectory() as td:
            docs=[]
            for stage in range(4):
                p=Path(td)/f'd{stage}.glb'; build_drink_stage(p,stage); docs.append(read_glb_json(p))
            self.assertEqual([len(d['nodes']) for d in docs],[5]*4)
            self.assertEqual([d['nodes'][1]['name'] for d in docs],['Lemonade_85pct','Lemonade_60pct','Lemonade_35pct','Lemonade_10pct'])
    def test_brownie_stages_have_closed_named_parts(self):
        with tempfile.TemporaryDirectory() as td:
            for stage in range(4):
                d=Path(td)/f'b{stage}.glb'; build_brownie_stage(d,stage); doc=read_glb_json(d)
                self.assertEqual(doc['asset']['generator'],'foodstage-showcase-local')
                self.assertGreaterEqual(len(doc['nodes']),3)
                self.assertIn('CakeInterior', {n['name'] for n in doc['nodes']})
if __name__=='__main__': unittest.main()
