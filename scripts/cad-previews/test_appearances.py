import json
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

from appearances import model_appearance


class AppearanceTests(unittest.TestCase):
    def test_failure_cancels_pending_exports_and_drains_running_workers(self):
        with tempfile.TemporaryDirectory() as temporary:
            repo = Path(temporary)
            source = repo / 'hardware/sample.scad'
            source.parent.mkdir()
            source.write_text('// ARBI_MODEL_APPEARANCE\n')
            work = repo / 'work'
            work.mkdir()
            first_started = threading.Event()
            fail_first = threading.Event()
            shutdown_started = threading.Event()
            drain_workers = threading.Event()
            started, errors = [], []
            surfaces = [[f'part-{i}', [.1, .2, .3], .5, 0, 0, 0, 1.5] for i in range(32)]

            class ObservedExecutor(ThreadPoolExecutor):
                def shutdown(self, wait=True, *, cancel_futures=False):
                    super().shutdown(wait=False, cancel_futures=cancel_futures)
                    shutdown_started.set()
                    if wait:
                        super().shutdown(wait=True)

            def export(command, target):
                if 'emit_appearance=true' in command:
                    target.write_text('metadata')
                    return 'ECHO: ' + json.dumps(['ARBI_MODEL_APPEARANCE', 1, [31.8, 9, 24.5], surfaces])
                index = int(next(arg.split('=')[1] for arg in command if arg.startswith('appearance_part=')))
                started.append(index)
                if index == 0:
                    first_started.set()
                    if not fail_first.wait(2):
                        raise TimeoutError('Test did not release the failing worker')
                    raise ValueError('Compiler failed')
                if not drain_workers.wait(2):
                    raise TimeoutError('Test did not drain the active worker')
                target.write_text('mesh')
                return ''

            def build():
                try:
                    model_appearance({'id': 'sample', 'entrypoint': 'hardware/sample.scad'}, repo, work, 1)
                except Exception as error:
                    errors.append(error)

            with patch('appearances.checked_export', side_effect=export), patch('appearances.ThreadPoolExecutor', ObservedExecutor):
                thread = threading.Thread(target=build)
                thread.start()
                try:
                    self.assertTrue(first_started.wait(2))
                    fail_first.set()
                    self.assertTrue(shutdown_started.wait(2))
                finally:
                    fail_first.set()
                    drain_workers.set()
                    thread.join(2)
                self.assertFalse(thread.is_alive())
                self.assertEqual(len(errors), 1)
                self.assertRegex(str(errors[0]), 'Compiler failed')
                # A worker may pick one more task before the failure is observed;
                # the other queued exports must never start.
                self.assertLessEqual(len(started), 2)


if __name__ == '__main__':
    unittest.main()
