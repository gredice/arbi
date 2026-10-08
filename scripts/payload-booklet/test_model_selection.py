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
        self.assertIn('payload-integrated-deck', enclosed)
        self.assertNotIn('payload-electronics-deck', enclosed)
        self.assertIn('payload-electronics-deck', bench)
        self.assertNotIn('payload-integrated-deck', bench)
        self.assertFalse({'payload-pan-fairing', 'payload-tilt-servo-boot', 'payload-camera-cowl'} & (bench | enclosed))
        self.assertEqual(bench & archived, {m['id'] for m in registry['archivedModels']
                                          if m.get('alternativeConfiguration') == 'payload-bench'})


if __name__ == '__main__':
    unittest.main()
