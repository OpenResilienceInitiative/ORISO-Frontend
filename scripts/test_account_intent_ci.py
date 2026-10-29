"""Dependency-free eligibility tests for the hosted verifier, separate from app proof."""
import importlib.util
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("account_intent_ci", Path(__file__).with_name("verify-account-intent-ci.py"))
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)

class EligibilityTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="c441-verifier-")
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "junit.xml"

    def report(self, children="", classname="required.test.tsx"):
        self.path.write_text('<testsuites><testsuite><testcase name="case" classname="' + classname + '">' + children + '</testcase></testsuite></testsuites>')
        return verifier.xml_report(self.path)

    def test_missing_report_is_not_green(self):
        self.assertFalse(verifier.junit_green(verifier.xml_report(self.path)))

    def test_invalid_report_is_not_green(self):
        self.path.write_text("<testsuites>")
        self.assertFalse(verifier.junit_green(verifier.xml_report(self.path)))

    def test_zero_cases_are_not_green(self):
        self.path.write_text('<testsuites><testsuite tests="999" /></testsuites>')
        self.assertFalse(verifier.junit_green(verifier.xml_report(self.path)))

    def test_actual_case_beats_invented_aggregate_counts(self):
        self.path.write_text('<testsuites tests="0"><testsuite tests="0"><testcase name="actual" /></testsuite></testsuites>')
        self.assertTrue(verifier.junit_green(verifier.xml_report(self.path)))

    def test_failure_is_not_green(self):
        self.assertFalse(verifier.junit_green(self.report('<failure message="assertion">actual mismatch</failure>')))

    def test_error_is_not_green(self):
        self.assertFalse(verifier.junit_green(self.report('<error message="import failed" />')))

    def test_skipped_case_cannot_prove_an_affected_path(self):
        self.assertFalse(verifier.junit_green(self.report('<skipped />')))

    def test_full_suite_skip_policy_is_explicit(self):
        self.assertTrue(verifier.junit_green(self.report('<skipped />'), allow_skipped=True))

    def test_another_passing_file_cannot_hide_missing_required_cases(self):
        self.assertFalse(verifier.junit_green(self.report(classname="unrelated.test.tsx"), ["required.test.tsx"]), "missing affected test file must fail eligibility")

    def test_matching_affected_file_is_green(self):
        self.assertTrue(verifier.junit_green(self.report(), ["required.test.tsx"]))

    def test_qualified_red_requires_the_actual_assertion_marker(self):
        marker = "second-dispatch"
        report = self.report('<failure message="second-dispatch">expected 2 calls, got 1</failure>')
        self.assertTrue(verifier.qualified_probe_red({"exitCode": 1, "junit": report}, marker))
        self.assertFalse(verifier.qualified_probe_red({"exitCode": 0, "junit": report}, marker))
        self.assertFalse(verifier.qualified_probe_red({"exitCode": 1, "junit": report}, "unobserved-marker"))

    def test_import_error_and_no_report_never_qualify_as_red(self):
        self.assertFalse(verifier.qualified_probe_red({"exitCode": 1, "junit": self.report('<error message="second-dispatch import failed" />')}, "second-dispatch"))
        self.assertFalse(verifier.qualified_probe_red({"exitCode": 1}, "second-dispatch"))

    def test_target_requires_immutable_matching_commit(self):
        verifier.require_target_commit("a" * 40, "a" * 40)
        with self.assertRaises(AssertionError): verifier.require_target_commit("a" * 40, "dev")
        with self.assertRaises(AssertionError): verifier.require_target_commit("a" * 40, "b" * 40)

    def test_xml_is_sanitized_before_it_is_kept(self):
        self.report('<failure message="Bearer fake-token">{"password":"test-value"}</failure>')
        stored = self.path.read_text()
        self.assertNotIn("fake-token", stored)
        self.assertNotIn("test-value", stored)
        self.assertIn("[REDACTED]", stored)

    def test_full_source_hash_changes_for_a_nested_input(self):
        root = Path(self.directory.name)
        (root / "nested").mkdir()
        (root / "nested/file.ts").write_text("before")
        with patch.object(verifier, "root", root, create=True), patch.object(verifier.subprocess, "check_output", return_value=b"nested/file.ts\0"), patch.object(verifier, "git", side_effect=lambda *args: "a" * 40):
            before = verifier.source_manifest()
            (root / "nested/file.ts").write_text("after")
            after = verifier.source_manifest()
        self.assertNotEqual(before["sourceSha256"], after["sourceSha256"])
        self.assertEqual(before["commit"], after["commit"])

    def test_required_admin_paths_include_new_actual_form_hook_and_otp_cases(self):
        expected = {"src/hooks/accountOperationActions.react.test.tsx", "src/pages/Profile/accountOperationForms.test.tsx", "src/components/TwoFactorSetup/ProfileTwoFactorSetup.intent.test.tsx", "src/components/CardEditable/CardEditable.test.tsx"}
        self.assertTrue(expected.issubset(verifier.ADMIN_REACT_FILES))

if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(EligibilityTests)
    result = unittest.TextTestRunner(verbosity=1).run(suite)
    report = {"tests": result.testsRun, "failures": len(result.failures), "errors": len(result.errors), "skipped": len(result.skipped)}
    if os.environ.get("ACCOUNT_INTENT_SELFTEST_REPORT"):
        Path(os.environ["ACCOUNT_INTENT_SELFTEST_REPORT"]).write_text(json.dumps(report, indent=2) + "\n")
    raise SystemExit(0 if result.wasSuccessful() and result.testsRun > 0 and not result.skipped else 1)
