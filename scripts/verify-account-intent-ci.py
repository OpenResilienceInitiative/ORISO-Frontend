#!/usr/bin/env python3
"""Fixed-source hosted application gates; no deployment, credentials or browser."""
import hashlib
import json
import os
import re
import signal
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

def git(*args):
    return subprocess.check_output(["git", *args], text=True).strip()

def source_manifest():
    paths = subprocess.check_output(["git", "ls-files", "-z"]).decode().split("\0")
    records = []
    for name in sorted(p for p in paths if p):
        file = root / name
        digest = hashlib.sha256()
        with file.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
        records.append({"path": name, "sha256": digest.hexdigest()})
    encoded = json.dumps(records, sort_keys=True, separators=(",", ":")).encode()
    return {"commit": git("rev-parse", "HEAD"), "tree": git("rev-parse", "HEAD^{tree}"),
            "sourceSha256": hashlib.sha256(encoded).hexdigest(), "files": records}

def sanitize(text):
    text = re.sub(r"(?i)Bearer\s+[A-Za-z0-9._~+/=-]+", "Bearer [REDACTED]", text)
    text = re.sub(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b", "[REDACTED JWT]", text)
    text = re.sub(r'(?i)("(?:password|oldPassword|newPassword|secret|otp|access_token|refresh_token)"\s*:\s*)"[^"]*"', r'\1"[REDACTED]"', text)
    return text

def xml_report(path):
    if not path.exists():
        return {"valid": False, "reason": "missing JUnit report"}
    try:
        tree = ET.parse(path)
    except ET.ParseError:
        return {"valid": False, "reason": "invalid JUnit report"}
    cases = list(tree.iter("testcase"))
    failures = [case for case in cases if case.find("failure") is not None]
    errors = [case for case in cases if case.find("error") is not None]
    skips = [case for case in cases if case.find("skipped") is not None]
    for element in tree.iter():
        if element.text:
            element.text = sanitize(element.text)
        for key, value in list(element.attrib.items()):
            element.set(key, sanitize(value))
    tree.write(path, encoding="utf-8", xml_declaration=True)
    return {"valid": True, "tests": len(cases), "failures": len(failures), "errors": len(errors), "skipped": len(skips),
            "testFiles": sorted({case.get("classname", "") for case in cases}),
            "failedCases": [{"name": c.get("name"), "className": c.get("classname"),
                             "message": sanitize(c.find("failure").get("message", "")),
                             "detail": sanitize(c.find("failure").text or "")[-14000:]} for c in failures]}

def run(label, command, timeout=1800, report=None, env_extra=None, expected_files=()):
    started = time.monotonic()
    raw = evidence / (label + ".raw.log")
    env = {**os.environ, "BROWSER": "none", **(env_extra or {})}
    try:
        with raw.open("w") as stream:
            process = subprocess.Popen(command, cwd=root, env=env, stdout=stream, stderr=subprocess.STDOUT, start_new_session=True)
            try:
                code = process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait(timeout=5)
                code = 124
    except OSError as error:
        raw.write_text(type(error).__name__ + ": unable to start the requested gate\n")
        code = 125
    content = raw.read_text(errors="replace")
    lines = content.splitlines()
    bounded = lines if len(lines) <= 4500 else lines[:100] + ["[middle omitted; raw SHA256 in receipt]"] + lines[-4400:]
    log = evidence / (label + ".log")
    log.write_text(sanitize("\n".join(bounded)) + "\n")
    receipt = {"label": label, "command": command, "exitCode": code, "seconds": round(time.monotonic() - started, 3),
               "rawLogSha256": hashlib.sha256(content.encode()).hexdigest(), "logLines": len(lines), "truncated": len(lines) > 4500}
    raw.unlink()
    if label == "ci-helper-self-test":
        self_test_report = evidence / "ci-helper-tests.json"
        try:
            receipt["selfTests"] = json.loads(self_test_report.read_text()) | {"valid": True}
        except (OSError, ValueError):
            receipt["selfTests"] = {"valid": False}
    if report:
        receipt["junit"] = xml_report(report)
        receipt["expectedTestFiles"] = list(expected_files)
    (evidence / (label + ".json")).write_text(json.dumps(receipt, indent=2) + "\n")
    counts = receipt.get("junit", receipt.get("selfTests", {}))
    quiet_counts = {key: value for key, value in counts.items() if key in ("valid", "tests", "failures", "errors", "skipped", "reason")}
    print(label, "exit", code, "seconds", receipt["seconds"], json.dumps(quiet_counts), flush=True)
    return receipt

FRONTEND_REACT_FILES = ['src/components/profile/ConsultantPrivateData.intent.test.tsx', 'src/components/profile/ProfileAvatarChoice.test.tsx', 'src/components/profile/EmailNotifications/EmailNotifications.appointments.test.tsx', 'src/components/anonymousChat/entryRoom/LiveChatAccess.test.tsx', 'src/components/twoFactorAuth/TwoFactorAuth.test.tsx', 'src/components/erstantwort/ErstantwortEmailOverlay.test.tsx', 'src/components/profile/AskerAboutMeData.test.tsx', 'src/components/profile/DisplayNameSettings.test.tsx', 'src/components/passwordReset/PasswordReset.test.tsx', 'src/components/twoFactorAuth/TwoFactorSetupDialog.test.tsx', 'src/components/localeSwitch/LocaleSwitch.test.tsx']
ADMIN_REACT_FILES = ['src/components/TwoFactorSetup/ProfileTwoFactorSetup.intent.test.tsx', 'src/pages/Profile/accountOperationForms.test.tsx', 'src/hooks/accountOperationActions.react.test.tsx', 'src/components/CardEditable/CardEditable.test.tsx', 'src/components/TwoFactorSetup/TwoFactorSetup.test.tsx', 'src/pages/users/Edit/index.test.tsx', 'src/pages/users/TenantAdminEdit/index.test.tsx']

def require_target_commit(actual, expected):
    assert re.fullmatch(r"[0-9a-f]{40}", expected), "target must be an exact immutable commit"
    assert actual == expected, "checkout is not the dispatched immutable target commit"

def junit_green(report, expected_files=(), allow_skipped=False):
    return bool(report.get("valid") and report.get("tests", 0) > 0 and report.get("errors") == 0
                and report.get("failures") == 0 and (allow_skipped or report.get("skipped") == 0)
                and set(expected_files).issubset(report.get("testFiles", [])))

def qualified_probe_red(record, marker):
    report = record.get("junit", {})
    failures = report.get("failedCases", [])
    return bool(record.get("exitCode", 0) != 0 and report.get("valid") and report.get("tests") == 1
                and report.get("failures") == 1 and report.get("errors") == 0 and report.get("skipped") == 0
                and len(failures) == 1 and marker in (failures[0]["message"] + failures[0]["detail"]))

def main():
    global root, evidence
    kind = sys.argv[1]
    phase = sys.argv[2]
    assert phase in ("react", "project")
    assert kind in ("frontend", "admin")
    root = Path.cwd()
    evidence = Path(os.environ["RUNNER_TEMP"]) / ("account-intent-evidence-" + phase)
    evidence.mkdir(parents=True, exist_ok=True)

    before = source_manifest()
    (evidence / "source-before.json").write_text(json.dumps(before, indent=2) + "\n")
    expected_commit = os.environ.get("ACCOUNT_INTENT_TARGET_SHA", os.environ["GITHUB_SHA"])
    require_target_commit(before["commit"], expected_commit)
    records = [run("ci-helper-self-test", [sys.executable, "-B", "scripts/test_account_intent_ci.py", "-q"], 30, env_extra={"ACCOUNT_INTENT_SELFTEST_REPORT": str(evidence / "ci-helper-tests.json")})]

    if kind == "frontend" and phase == "react":
        probe = root / "src/components/profile/__c441_diagnostic_consultant_retry.test.tsx"
        assert not probe.exists(), "probe path is already owned by source"
        probe.write_text((root / "scripts/fixtures/consultant-email-unknown-retry.red.tsx.txt").read_text())
        try:
            record = run("consultant-counterfactual", ["node", "node_modules/vitest/vitest.mjs", "run", "--project", "unit", "--maxWorkers=1", "--minWorkers=1", str(probe.relative_to(root)), "--reporter=junit", "--outputFile=" + str(evidence / "consultant-counterfactual.xml")], 180, evidence / "consultant-counterfactual.xml")
            junit = record.get("junit", {})
            failures = junit.get("failedCases", [])
            marker = "account-intent-unknown-retry-second-dispatch"
            record["qualifiedAssertionRed"] = qualified_probe_red(record, marker)
            (evidence / "consultant-counterfactual.json").write_text(json.dumps(record, indent=2) + "\n")
            records.append(record)
        finally:
            probe.unlink()
        targeted = FRONTEND_REACT_FILES
        assert all((root / name).is_file() for name in targeted), "missing required affected React test source"
        records.append(run("react-account-paths", ["node", "node_modules/vitest/vitest.mjs", "run", "--project", "unit", "--maxWorkers=2", "--minWorkers=1", *targeted, "--reporter=junit", "--outputFile=" + str(evidence / "react-account-paths.xml")], 420, evidence / "react-account-paths.xml", expected_files=targeted))
    elif kind == "admin" and phase == "react":
        targeted = ADMIN_REACT_FILES
        assert all((root / name).is_file() for name in targeted), "missing required affected React test source"
        records.append(run("react-account-paths", ["node", "node_modules/vitest/vitest.mjs", "run", "--project", "unit", "--maxWorkers=2", *targeted, "--reporter=junit", "--outputFile=" + str(evidence / "react-account-paths.xml")], 420, evidence / "react-account-paths.xml", expected_files=targeted))
    if phase == "project":
        protocol_report = evidence / "node-contract.xml"
        protocol = run("node-contract", ["node", "--max-old-space-size=256", "--experimental-strip-types", "--test", "--experimental-test-isolation=none", "--test-concurrency=1", "--test-reporter=junit", "--test-reporter-destination=" + str(protocol_report), "scripts/account-operation-auth-retry.node-test.mjs", "scripts/account-operation-intents.node-test.mjs"], 60, protocol_report)
        protocol["expectedTestCount"] = 25 if kind == "frontend" else 29
        records.append(protocol)
        if kind == "frontend":
            records.append(run("script-tests", ["npm", "run", "test:scripts"], 120))
        unit_command = ["npm", "run", "test:unit" if kind == "frontend" else "test", "--", *([] if kind == "frontend" else ["--maxWorkers=2"]), "--reporter=junit", "--outputFile=" + str(evidence / "unit.xml")]
        records.append(run("unit", unit_command, 1800, evidence / "unit.xml"))
        commands = ([("lint-scripts", ["npm", "run", "lint:scripts"]), ("lint-style", ["npm", "run", "lint:style"])] if kind == "frontend" else [("lint-js", ["node", "node_modules/eslint/bin/eslint.js", ".", "--max-warnings=0"]), ("lint-css", ["npm", "run", "lint:css"]), ("lint-formatting", ["npm", "run", "lint:formatting"])])
        for label, command in commands:
            records.append(run(label, command, 600))
        records.append(run("build", ["npm", "run", "build"], 900, env_extra={"CI": "false", "REACT_APP_BUILD_COMMIT": before["commit"], "VITE_BUILD_COMMIT": before["commit"]}))
    after = source_manifest()
    (evidence / "source-after.json").write_text(json.dumps(after, indent=2) + "\n")
    summary = {"repositoryKind": kind, "phase": phase, "commit": before["commit"], "nodeVersion": subprocess.check_output(["node", "--version"], text=True).strip(),
               "hostRepository": os.environ["GITHUB_REPOSITORY"], "hostCommit": os.environ["GITHUB_SHA"],
               "targetRepository": os.environ.get("ACCOUNT_INTENT_TARGET_REPOSITORY", os.environ["GITHUB_REPOSITORY"]),
               "targetCommit": expected_commit, "npmVersion": subprocess.check_output(["npm", "--version"], text=True).strip(),
               "lockSha256": hashlib.sha256((root / "package-lock.json").read_bytes()).hexdigest(),
               "sourceUnchanged": before == after, "records": records, "notVerified": ["browser", "real native/backend effect", "current-human authorization"]}
    (evidence / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    ordinary = [r for r in records if r["label"] != "consultant-counterfactual"]
    passes = all(r["exitCode"] == 0 for r in ordinary)
    for record in ordinary:
        if record["label"] == "ci-helper-self-test":
            passes = passes and junit_green(record.get("selfTests", {}))
        if "expectedTestCount" in record:
            passes = passes and record.get("junit", {}).get("tests") == record["expectedTestCount"]
        if "junit" in record:
            report = record["junit"]
            passes = passes and junit_green(report, record.get("expectedTestFiles", ()), allow_skipped=record["label"] == "unit")
    probe = next((record for record in records if record["label"] == "consultant-counterfactual"), None)
    if probe:
        report = probe.get("junit", {})
        probe["qualifiedBehaviorGreen"] = bool(probe["exitCode"] == 0 and report.get("tests") == 1 and junit_green(report))
        passes = passes and (probe["qualifiedAssertionRed"] or probe["qualifiedBehaviorGreen"])
        (evidence / "consultant-counterfactual.json").write_text(json.dumps(probe, indent=2) + "\n")
        (evidence / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print("source unchanged", before == after, "ordinary gates pass", bool(passes), flush=True)
    raise SystemExit(0 if before == after and passes else 1)

if __name__ == "__main__":
    main()
