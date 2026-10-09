"""Keep historical configurations out of the current assembly export."""
import json
from pathlib import Path
import unittest

from model_selection import selected_models


class SelectionTests(unittest.TestCase):
    def test_current_and_explicit_alternative(self):
        registry = json.loads((Path(__file__).resolve().parents[2] / 'hardware/models.json').read_text())
        enclosed = {m['id'] for m in selected_models(registry, True)}
        bench = {m['id'] for m in selected_models(registry, False)}
        archived = {m['id'] for m in registry['archivedModels']}
        self.assertEqual(len(enclosed), 13)
        self.assertEqual(len(bench), 11)
        self.assertFalse(enclosed & archived)
        self.assertIn('camera-pod-integrated-deck', enclosed)
        self.assertNotIn('camera-pod-electronics-deck', enclosed)
        self.assertIn('camera-pod-electronics-deck', bench)
        self.assertNotIn('camera-pod-integrated-deck', bench)
        self.assertFalse({'camera-pod-pan-fairing', 'camera-pod-tilt-servo-boot', 'camera-pod-camera-cowl'} & (bench | enclosed))
        self.assertEqual(bench & archived, {m['id'] for m in registry['archivedModels']
                                          if m.get('alternativeConfiguration') == 'camera-pod-bench'})


if __name__ == '__main__':
    unittest.main()
