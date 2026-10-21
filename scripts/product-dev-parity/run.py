#!/usr/bin/env python3
"""Retained84 observation/conformance; raw comparison stays a separate diagnostic."""
from pathlib import Path
import argparse, datetime, hashlib, json, os, shutil, signal, socket, subprocess, time
from conformance import evaluate

B = Path(__file__).resolve().parent
REPO = B.parents[1]
NODE = Path(shutil.which('node') or '/missing-node')
CLOSURE = None
SHA = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
READ = lambda p: json.loads(p.read_text())
NOW = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()

def write(p, value):
    p.parent.mkdir(parents=True, exist_ok=True)
    temporary = p.with_name(p.name + '.tmp')
    temporary.write_text(json.dumps(value, indent=2) + '\n')
    temporary.replace(p)

def ps():
    rows = []
    for line in subprocess.check_output(['ps', '-axo', 'pid=,ppid=,pgid=,stat=,lstart=,command='], text=True).splitlines():
        fields = line.split(None, 9)
        if len(fields) == 10 and not fields[3].startswith('Z'):
            rows.append(dict(pid=int(fields[0]), ppid=int(fields[1]), pgid=int(fields[2]), birth=' '.join(fields[4:9]), command=fields[9]))
    return rows

def owned(group, known):
    rows = ps()
    ids = {r['pid'] for r in rows if r['pgid'] == group or known.get(str(r['pid']), {}).get('birth') == r['birth']}
    while True:
        expanded = ids | {r['pid'] for r in rows if r['ppid'] in ids}
        if expanded == ids:
            break
        ids = expanded
    result = [r for r in rows if r['pid'] in ids]
    known.update({str(r['pid']): r for r in result})
    return result

def cleanup(group, known):
    # Failure cleanup is explicitly forced, never recorded as a natural PASS.
    rows = owned(group, known)
    for row in rows:
        try:
            os.kill(row['pid'], signal.SIGTERM)
        except ProcessLookupError:
            pass
    end = time.monotonic() + 10
    while owned(group, known) and time.monotonic() < end:
        time.sleep(.1)
    for row in owned(group, known):
        try:
            os.kill(row['pid'], signal.SIGKILL)
        except ProcessLookupError:
            pass

def cache_metadata():
    result = {}
    for name in ['.cache', '.vite', '.vite-temp']:
        directory = REPO / 'node_modules' / name
        if directory.exists():
            for item in directory.rglob('*'):
                if item.is_file():
                    stat = item.stat()
                    result[str(item.relative_to(REPO / 'node_modules'))] = dict(size=stat.st_size, mtime_ns=stat.st_mtime_ns)
    return result

def map_files(directory):
    result = {}
    for current, dirs, names in os.walk(directory):
        dirs[:] = [name for name in dirs if name != 'node_modules']
        for name in names:
            file = Path(current) / name
            assert file.is_file() and not file.is_symlink()
            result[str(file.relative_to(directory))] = SHA(file)
    return result

def reject_symlink_ancestors(destination):
    for component in [destination, *destination.parents]:
        assert not component.is_symlink(), 'Refuse symlink destination/ancestor: ' + str(component)

def verify_regular(file, expected):
    assert file.is_file() and not file.is_symlink(), 'Expected regular input: ' + str(file)
    assert SHA(file) == expected['sha256'] and file.stat().st_size == expected['bytes']
    assert oct(file.stat().st_mode & 0o777) == expected['mode'], 'Input mode changed: ' + str(file)

def closure_guard(closure):
    verify_regular(REPO / closure['pinnedInstalledReactPlugin']['file'], closure['pinnedInstalledReactPlugin'])
    for name, expected in closure['canonicalRegularCopies'].items():
        verify_regular(REPO / name, expected)
    for name, expected in closure['inputSourceBindings'].items():
        verify_regular(REPO / name, expected)
    for name, package in closure['packages'].items():
        directory = REPO / 'node_modules' / name
        assert str(directory.resolve()) == package['realpath']
        actual = {str(file.relative_to(directory)) for file in directory.rglob('*') if file.is_file()}
        assert actual == set(package['regularFiles']) and not package['symlinks']
        assert not any(file.is_symlink() for file in directory.rglob('*'))
        for relative, expected in package['regularFiles'].items():
            verify_regular(directory / relative, expected)
    actual_links = {package.name: {'targetRealpath': str(package.resolve()), 'kind': 'directory' if package.is_dir() else 'file'}
                    for package in (REPO / 'node_modules').iterdir()
                    if not package.name.startswith('.') and package.name != 'react-dom'}
    assert actual_links == closure['existingRootPackageLinks'], 'Installed package link closure changed'

def materialize(root, fixture):
    closure = CLOSURE
    closure_guard(closure)
    reject_symlink_ancestors(root)
    root.mkdir(parents=True, exist_ok=False)
    assert set(fixture['canonicalCopies']) == set(closure['canonicalRegularCopies'])
    for name in fixture['canonicalCopies']:
        destination = root / name
        reject_symlink_ancestors(destination)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(REPO / name, destination)
        verify_regular(destination, closure['canonicalRegularCopies'][name])
    for name, text in fixture['syntheticFiles'].items():
        destination = root / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(text)
    # Same canonical template plus explicit identical inert padding in both legs.
    template = root / 'src/pages/app.html'
    template.write_text(template.read_text().replace('</body>', fixture['htmlPadding'] + '\n</body>'))
    (root / 'src/extensions/pages').mkdir(parents=True)
    dependencies = root / 'node_modules'
    reject_symlink_ancestors(dependencies)
    dependencies.mkdir()
    for package in (REPO / 'node_modules').iterdir():
        if not package.name.startswith('.') and package.name != 'react-dom':
            (dependencies / package.name).symlink_to(package.resolve(), target_is_directory=package.is_dir())
    # Reuse canonical dev-fixture.mjs:45-55: preserve shim-relative package identity.
    # Never copy through the old package symlink into canonical node_modules.
    destination = dependencies / 'react-dom'
    reject_symlink_ancestors(destination)
    destination.mkdir(exist_ok=False)
    for name, expected in closure['packages']['react-dom']['regularFiles'].items():
        target = destination / name
        reject_symlink_ancestors(target)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(REPO / 'node_modules/react-dom' / name, target)
        verify_regular(target, expected)

def compare(execution, scenarios, fixture):
    rows, controls = [], []
    cors = ['access-control-allow-origin', 'access-control-allow-methods', 'access-control-allow-headers']
    asset_sha = hashlib.sha256(fixture['syntheticFiles']['public/parity-large.txt'].encode()).hexdigest()
    for scenario in scenarios:
        legs = {}
        expected_ids = sorted(row['id'] for row in scenario['requests'])
        assert len(expected_ids) == len(set(expected_ids))
        for engine in ['legacy', 'candidate']:
            native = READ(execution / scenario['id'] / engine / 'responses.json')
            assert sorted(row['id'] for row in native) == expected_ids, 'Missing/duplicate/foreign response'
            for response in native:
                for suffix, key in [('wire', 'wireSHA256'), ('decoded', 'decodedSHA256')]:
                    assert SHA(execution / scenario['id'] / engine / (response['id'] + '.' + suffix)) == response[key]
            legs[engine] = {row['id']: row for row in native}
        for expected in scenario['requests']:
            left, right = (legs[engine][expected['id']] for engine in ['legacy', 'candidate'])
            fields = ['status']
            if expected['axis'] == 'cors':
                fields += cors
            elif expected['axis'] == 'compression':
                fields += ['content-encoding', 'vary']
            elif expected['axis'] == 'redirect':
                fields += ['location', 'content-type']
            elif expected['axis'] in ['service-worker', 'package-proxy']:
                fields += ['content-type', 'decodedSHA256']
            def value(row, field):
                return row[field] if field in ['status', 'decodedSHA256'] else row['headers'].get(field)
            differences = {field: {'legacy': value(left, field), 'candidate': value(right, field)} for field in fields if value(left, field) != value(right, field)}
            if expected['axis'] == 'host':
                def accepted(engine, row):
                    body = (execution / scenario['id'] / engine / (row['id'] + '.decoded')).read_bytes()
                    if expected['routeClass'] == 'owned-settings':
                        try:
                            return row['status'] == 200 and json.loads(body).get('proxyPath') == '/p'
                        except (ValueError, AttributeError):
                            return False
                    return row['status'] == 200 and row['containsAppEntryMarker']
                a, b = accepted('legacy', left), accepted('candidate', right)
                if a != b:
                    differences['acceptedByRealRoute'] = dict(legacy=a, candidate=b)
            rows.append(dict(scenario=scenario['id'], case=expected['id'], axis=expected['axis'], legacy={field:value(left,field) for field in fields}, candidate={field:value(right,field) for field in fields}, differences=differences, equal=not differences))
        if not scenario['packageProxy']:
            for engine in ['legacy', 'candidate']:
                data = legs[engine]
                controls.append(dict(scenario=scenario['id'], engine=engine, control='large-public-exact-decoded-identity+gzip', passed=all(data['compression-public-' + enc]['status'] == 200 and data['compression-public-' + enc]['decodedSHA256'] == asset_sha for enc in ['identity', 'gzip'])))
                controls.append(dict(scenario=scenario['id'], engine=engine, control='html-gzip-preserves-own-identity-body', passed=data['compression-html-gzip']['status'] == data['compression-html-identity']['status'] == 200 and data['compression-html-gzip']['decodedSHA256'] == data['compression-html-identity']['decodedSHA256']))
                if engine == 'legacy':
                    controls.append(dict(scenario=scenario['id'], engine=engine, control='large-public-really-gzip-compressed-baseline', passed=data['compression-public-gzip']['headers'].get('content-encoding') == 'gzip'))
    assert len(rows) == 84 and len({(row['scenario'],row['case']) for row in rows}) == 84
    assert len(controls) == 10
    result = dict(pairedCases=len(rows), observedResponses=len(rows)*2, unequalPairs=sum(not r['equal'] for r in rows), controlFailures=sum(not r['passed'] for r in controls), rows=rows, controls=controls, noProductionApproval=True, scope='minimal-entry real server middleware differential only; whole app equivalence OPEN')
    write(execution / 'comparison.json', result)
    return result

def canonical_snapshot():
    revision = subprocess.check_output(['git','rev-parse','HEAD'], cwd=REPO, text=True).strip()
    names = subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'], cwd=REPO).decode().split('\0')
    files, modes = {}, {}
    for name in sorted(set(filter(None,names))):
        file = REPO / name
        assert file.is_file() and not file.is_symlink(), 'Unexpected source entry: ' + name
        files[name], modes[name] = SHA(file), file.stat().st_mode & 0o111
    return dict(revision=revision, files=files, executableBits=modes,
        dirty=subprocess.check_output(['git','status','--porcelain','--untracked-files=all'], cwd=REPO,text=True))

def regular_receipt(file):
    assert file.is_file() and not file.is_symlink()
    return dict(sha256=SHA(file), bytes=file.stat().st_size, mode=oct(file.stat().st_mode & 0o777))

def current_closure(fixture):
    packages = {}
    for name in ['react-dom','react','scheduler']:
        directory = REPO / 'node_modules' / name
        packages[name] = dict(realpath=str(directory.resolve()),
            regularFiles={str(f.relative_to(directory)):regular_receipt(f) for f in directory.rglob('*') if f.is_file()},
            symlinks=[str(f) for f in directory.rglob('*') if f.is_symlink()])
    plugin = 'node_modules/@vitejs/plugin-react/dist/index.js'
    return dict(canonicalRegularCopies={n:regular_receipt(REPO/n) for n in fixture['canonicalCopies']},
        inputSourceBindings={}, pinnedInstalledReactPlugin=dict(file=plugin, **regular_receipt(REPO/plugin)),
        packages=packages, existingRootPackageLinks={f.name:dict(targetRealpath=str(f.resolve()), kind='directory' if f.is_dir() else 'file')
            for f in (REPO/'node_modules').iterdir() if not f.name.startswith('.') and f.name != 'react-dom'})

def main():
    global CLOSURE
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    execution = Path(args.output).resolve()
    execution.mkdir(parents=True, exist_ok=False)
    assert subprocess.check_output([str(NODE),'--version'],text=True).strip() == 'v22.23.3'
    source = canonical_snapshot()
    write(execution/'source-before.json',source)
    scenarios = READ(B/'matrix.json')['scenarios']
    fixture = READ(B/'fixture-plan.json')
    assert len(scenarios) == 4 and [len(s['requests']) for s in scenarios] == [32,10,32,10]
    CLOSURE = current_closure(fixture)
    write(execution/'fixture-inputs.json',CLOSURE)
    write(execution/'probe-inputs.json',dict(files={str(f.relative_to(B)):SHA(f) for f in B.iterdir() if f.is_file()},lockSHA256=SHA(REPO/'package-lock.json')))
    def guard():
        assert canonical_snapshot() == source, 'Checkout source changed'
        closure_guard(CLOSURE)
    guard()
    scratch = REPO / '.tmp-proof' / ('full84-' + str(os.getpid()))
    assert not scratch.exists(), 'Refuse fixture/cache reuse'
    before_cache = cache_metadata()
    write(execution/'canonical-cache-before.json',before_cache)
    write(execution/'runtime-binary.json',dict(nodePath=str(NODE),nodeSHA256=SHA(NODE),expectedMeasuredVersion='v22.23.3',noInstall=True))
    state = dict(controllerPID=os.getpid(),stage='materializing',terminal=False,commands=[],startedAtUTC=NOW(),noRetries=True)
    write(execution/'run-state.json',state)
    print(json.dumps(dict(controllerPID=os.getpid(),stage=state['stage'])),flush=True)
    def interrupted(signum, _frame):
        raise TimeoutError('CI interrupted the comparison: signal ' + str(signum))
    signal.signal(signal.SIGTERM, interrupted)
    active = None
    try:
        for scenario in scenarios:
            for engine in ['legacy', 'candidate']:
                guard()
                root = scratch / scenario['id'] / engine
                materialize(root, fixture)
                output = execution / scenario['id'] / engine
                output.mkdir(parents=True)
                write(output / 'fixture-before.json', map_files(root))
                scenario_file = output / 'scenario.json'
                write(scenario_file, scenario)
                argv = [str(NODE), str(B / 'observe.mjs'), str(REPO), str(root), engine, str(scenario_file), str(output)]
                env = {k: os.environ[k] for k in ['HOME', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TMPDIR'] if k in os.environ}
                env.update(PATH=str(NODE.parent)+':/usr/bin:/bin:/usr/sbin:/sbin', CI='true', TZ='Europe/Berlin')
                row = dict(engine=engine, scenario=scenario['id'], argv=argv, cwd=str(root), environment={'CI': 'true', 'TZ': 'Europe/Berlin', 'PATH': env['PATH']}, inheritedEnvironmentKeys=sorted(k for k in env if k not in ['CI', 'TZ', 'PATH']), deadlineSeconds=180, startedAtUTC=NOW(), observedProcesses={}, forcedSafetyCleanup=False)
                state['commands'].append(row)
                state.update(stage=scenario['id'] + ':' + engine, active=row)
                with (output / 'stdout-stderr.log').open('x') as log:
                    child = subprocess.Popen(argv, cwd=root, env=env, stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
                    active = child, row
                    row.update(pid=child.pid, pgid=child.pid)
                    write(execution / 'run-state.json', state)
                    print(json.dumps(dict(pid=child.pid, pgid=child.pid, stage=state['stage'])), flush=True)
                    started = time.monotonic()
                    while child.poll() is None or owned(child.pid, row['observedProcesses']):
                        owned(child.pid, row['observedProcesses'])
                        write(output / 'process.json', row)
                        write(execution / 'run-state.json', state)
                        assert time.monotonic() - started < 180, 'Native leg/descendant drain deadline exceeded'
                        time.sleep(.1)
                    row.update(exitCode=child.wait(), terminal=True, durationSeconds=time.monotonic()-started, endedAtUTC=NOW(), naturalExit=True)
                    active = None
                write(output / 'process.json', row)
                assert row['exitCode'] == 0, 'Actual observation infrastructure failed; preserve and stop'
                assert READ(output / 'observation-complete.json')['executed'] == len(scenario['requests'])
                ready = READ(output / 'ready.json')
                released = {}
                for name in ['port', 'stubPort']:
                    with socket.socket() as connection:
                        connection.settimeout(1)
                        released[name] = connection.connect_ex(('127.0.0.1', ready[name])) != 0
                assert all(released.values()), 'Owned port remains live'
                write(output / 'port-release.json', released)
                write(output / 'fixture-after.json', map_files(root))
                shutil.copytree(root, output / 'fixture-archive', ignore=shutil.ignore_patterns('node_modules'))
                guard()
                assert cache_metadata() == before_cache, 'Canonical dependency cache changed'
        result = compare(execution, scenarios, fixture)
        raw_failed = bool(result['unequalPairs'] or result['controlFailures'])
        raw_diagnostic = dict(status='FAIL' if raw_failed else 'PASS',
            diagnosticExitCode=1 if raw_failed else 0,
            exitKind='computed raw-comparison diagnostic; not a separate native process',
            pairedCases=result['pairedCases'], observedResponses=result['observedResponses'],
            unequalPairs=result['unequalPairs'], controlFailures=result['controlFailures'],
            comparisonSHA256=SHA(execution / 'comparison.json'))
        write(execution / 'raw-comparison-diagnostic.json', raw_diagnostic)
        conformance = evaluate(execution, scenarios, fixture, result, REPO)
        write(execution / 'contract-conformance.json', conformance)
        accepted = conformance['observationsComplete'] and conformance['status'] == 'PASS'
        state.update(stage='bounded-middleware-conformance' if accepted else 'observed-contract-failures',
            rawComparison=raw_diagnostic['status'], contractConformance=conformance['status'],
            terminal=True, endedAtUTC=NOW())
        print(json.dumps(dict(rawComparison=raw_diagnostic, contractConformance=conformance['status'],
            observationsComplete=conformance['observationsComplete'], noProductionApproval=True)), flush=True)
        return 0 if accepted else 1
    except BaseException as error:
        state.update(stage='infrastructure-failed-no-retry', terminal=True, failure=repr(error), endedAtUTC=NOW())
        if active:
            child, row = active
            row['forcedSafetyCleanup'] = True
            cleanup(child.pid, row['observedProcesses'])
            child.wait(timeout=10)
            row.update(exitCode=child.returncode, terminal=True, endedAtUTC=NOW())
        raise
    finally:
        write(execution / 'run-state.json', state)
        seen = {pid: record for row in state['commands'] for pid, record in row['observedProcesses'].items()}
        live = [row for row in ps() if seen.get(str(row['pid']), {}).get('birth') == row['birth']]
        write(execution / 'process-release.json', dict(atUTC=NOW(), observedPIDs=sorted(map(int, seen)), liveSameBirthPIDs=live, controllerPID=os.getpid(), callerMustConfirmControllerExit=True, sourceGuardPassed=None, retainedScratch=str(scratch)))
        assert not live
        guard()
        write(execution/'source-after.json',canonical_snapshot())
        write(execution/'canonical-cache-after.json',cache_metadata())
        assert cache_metadata() == before_cache

if __name__ == '__main__':
    raise SystemExit(main())
