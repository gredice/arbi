import subprocess
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from reference_meshes import positive_jobs, prepare_references


class ReferenceMeshTests(unittest.TestCase):
    def test_jobs_rejects_nonpositive_or_malformed_values(self):
        self.assertEqual(positive_jobs("1"), 1)
        for value in ["0", "-1", "1.5", "1x", ""]:
            with self.assertRaises(ValueError):
                positive_jobs(value)

    def test_exports_overlap_deduplicate_across_references_and_preserve_component_order(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            paths = [root / "one.csg", root / "two.csg"]
            paths[0].write_text("group() {\ncube(size=[1,1,1]);\nsphere(r=2);\n}")
            paths[1].write_text("group() {\nsphere(r=2);\ncylinder(h=3,r=1);\n}")
            active, peak, calls = 0, 0, []
            lock = threading.Lock()

            def run(command, **kwargs):
                nonlocal active, peak
                with lock:
                    active += 1
                    peak = max(peak, active)
                    calls.append(command)
                time.sleep(.05)
                Path(command[2]).write_text(Path(command[3]).read_text())
                with lock:
                    active -= 1
                return subprocess.CompletedProcess(command, 0, "", "")

            with patch("reference_meshes.subprocess.run", side_effect=run):
                result = prepare_references(paths, root, 2)
            self.assertEqual(len(calls), 3)
            self.assertEqual(peak, 2)
            self.assertEqual(active, 0)
            self.assertEqual(result[paths[0]][1], result[paths[1]][0])
            self.assertTrue(result[paths[0]][0].read_text().startswith("cube("))
            self.assertTrue(result[paths[1]][1].read_text().startswith("cylinder("))

    def test_compiler_failures_diagnostics_and_missing_meshes_propagate_after_workers_drain(self):
        for mode in ["exit", "timeout", "warning", "error", "missing", "empty"]:
            with self.subTest(mode=mode), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                csg = root / "one.csg"
                csg.write_text("group() {\ncube(size=[1,1,1]);\nsphere(r=2);\n}")
                finished = threading.Event()

                def run(command, **kwargs):
                    if Path(command[3]).read_text().startswith("sphere("):
                        time.sleep(.1)
                        Path(command[2]).write_text("valid mesh")
                        finished.set()
                        return subprocess.CompletedProcess(command, 0, "", "")
                    # Let the other worker start before failing.
                    time.sleep(.02)
                    if mode == "exit":
                        raise subprocess.CalledProcessError(2, command)
                    if mode == "timeout":
                        raise subprocess.TimeoutExpired(command, 120)
                    if mode != "missing":
                        Path(command[2]).write_text("" if mode == "empty" else "mesh")
                    return subprocess.CompletedProcess(command, 0, "", f"{mode.upper()}: diagnostic" if mode in ["warning", "error"] else "")

                with patch("reference_meshes.subprocess.run", side_effect=run):
                    with self.assertRaises((ValueError, subprocess.SubprocessError)):
                        prepare_references([csg], root, 2)
                self.assertTrue(finished.is_set())


if __name__ == "__main__":
    unittest.main()
