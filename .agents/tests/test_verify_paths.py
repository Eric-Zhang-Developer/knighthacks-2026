"""Stdlib regression tests for the verifier's shell placeholder boundary."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shlex
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))
spec = importlib.util.spec_from_file_location("project_verify", SCRIPTS / "verify.py")
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)


class VerifyPaths(unittest.TestCase):
    def test_posix_quoting_is_unchanged(self):
        for value in ["plain", "space here", "apostrophe's", "$(command)", "%HOME%!", ""]:
            self.assertEqual(verify.quote_path(value, windows=False), shlex.quote(value))

    def test_windows_always_quotes_and_preserves_trailing_slashes(self):
        self.assertEqual(verify.quote_path("a&b", windows=True), '"a&b"')
        self.assertEqual(verify.quote_path("C:\\", windows=True), '"C:\\\\"')
        self.assertEqual(verify.quote_path("", windows=True), '""')

    def test_windows_rejects_expansion_and_quote_injection(self):
        for value in ['a" & command', "%PATH%", "!PATH!", "line\nnext", "line\rnext", "null\x00"]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                verify.quote_path(value, windows=True)

    def test_real_runner_receives_exact_paths(self):
        with tempfile.TemporaryDirectory(prefix="verify space & (roundtrip) ^ café ") as tmp:
            root = Path(tmp)
            script = root / "record.py"
            script.write_text("import json, pathlib, sys\npathlib.Path(sys.argv[2], 'args.json').write_text(json.dumps(sys.argv[1:]))\n", encoding="utf-8")
            out = root / "evidence & (kept)"
            # Trusted command text: placeholders themselves must add shell quoting.
            executable = f'"{sys.executable}"' if os.name == "nt" else shlex.quote(sys.executable)
            command = executable + ' record.py {worktree} {out}'
            with patch.object(verify, "root_from", return_value=root), patch.object(verify, "load_config", return_value={"verify": {"command": command, "timeout": 10}}), patch.object(verify, "evidence_dir", return_value=out), patch.object(verify, "git", return_value="test-sha"), contextlib.redirect_stdout(io.StringIO()) as output:
                result = verify.main(["--slug", "test", "--worktree", str(root)])
            self.assertEqual(result, 0, output.getvalue())
            self.assertEqual(json.loads((out / "args.json").read_text()), [str(root), str(out)])
            self.assertIn(" pass at ", output.getvalue())

    @unittest.skipUnless(os.name == "nt", "Exercises native cmd.exe argv parsing")
    def test_native_trailing_backslash_roundtrip(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "record.py").write_text("import json, pathlib, sys\npathlib.Path('args.json').write_text(json.dumps(sys.argv[1:]))\n", encoding="utf-8")
            values = ["C:\\", "C:\\space & (group) ^ café\\", "a&b", "café"]
            command = verify.quote_path(sys.executable) + " record.py " + " ".join(verify.quote_path(v) for v in values)
            self.assertEqual(verify.run(command, root, 10), 0)
            self.assertEqual(json.loads((root / "args.json").read_text()), values)

    def test_unsupported_path_has_accurate_diagnostic(self):
        with patch.object(verify, "root_from", return_value=Path.cwd()), patch.object(verify, "load_config", return_value={"verify": {"command": "command {worktree}", "timeout": 3}}), patch.object(verify, "quote_path", side_effect=ValueError("unsupported Windows path")), patch.object(verify, "run") as run, contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(verify.main(["--slug", "test"]), 1)
        self.assertIn("unsupported path", output.getvalue())
        self.assertNotIn("bad placeholder", output.getvalue())
        run.assert_not_called()

    def test_failure_and_timeout_result_lines(self):
        for result, text in [(7, "FAIL (exit 7)"), (None, "FAIL (timed out after 3s)")]:
            with self.subTest(result=result), patch.object(verify, "root_from", return_value=Path.cwd()), patch.object(verify, "load_config", return_value={"verify": {"command": "trusted-command", "timeout": 3}}), patch.object(verify, "git", return_value="test-sha"), patch.object(verify, "run", return_value=result), contextlib.redirect_stdout(io.StringIO()) as output:
                self.assertEqual(verify.main(["--slug", "test"]), 1)
            self.assertIn(text, output.getvalue())


if __name__ == "__main__":
    unittest.main()
