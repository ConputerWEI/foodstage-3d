import json
import tempfile
import unittest
from pathlib import Path

from tools.showcase_models import build_chicken_stage, read_glb_json


class ShowcaseModelTests(unittest.TestCase):
    def test_chicken_stages_have_expected_piece_counts_and_embedded_geometry(self):
        with tempfile.TemporaryDirectory() as td:
            for stage, expected in enumerate((6, 4, 2, 1)):
                path = Path(td) / f"{stage}.glb"
                build_chicken_stage(path, expected)
                doc = read_glb_json(path)
                self.assertEqual(len(doc["nodes"]), expected)
                self.assertGreater(len(doc["meshes"]), 0)
                self.assertTrue(all("mesh" in node for node in doc["nodes"]))
                self.assertEqual(doc["asset"]["generator"], "foodstage-showcase-local")


if __name__ == "__main__":
    unittest.main()
