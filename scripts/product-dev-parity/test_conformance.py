"""Negative controls for the bounded semantic gate, not application mocks."""
from pathlib import Path
from tempfile import TemporaryDirectory
import json
import gzip
import unittest

from conformance import (Shell, check_missing_worker, check_shell, digest,
                         refresh_preamble, render_app_template,
                         require_raw_pair, response_inventory, variant)


ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent


class ShellContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        fixture = json.loads((HERE / 'fixture-plan.json').read_text())
        cls.template = (ROOT / 'src/pages/app.html').read_text().replace(
            '</body>', fixture['htmlPadding'] + '\n</body>')
        cls.plugin = (ROOT / 'node_modules/@vitejs/plugin-react/dist/index.js').read_text()
        rendered = render_app_template(cls.template, '')
        cls.legacy = rendered.replace('</head>', '<script defer src="/static/js/app.bundle.js"></script></head>')
        cls.candidate = rendered.replace('<script src="/config.js"></script>', '')
        cls.candidate = cls.candidate.replace('<head>', '<head><script src="/config.js"></script>'
            + '<script type="module">' + refresh_preamble(cls.plugin, '') + '</script>'
            + '<script type="module" src="/@vite/client"></script>')
        cls.candidate = cls.candidate.replace('</body>', '<script type="module" src="/src/initApp.js"></script></body>')

    def check(self, source, engine='candidate', **headers):
        check_shell(dict(status=200, headers={'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-cache', **headers}), source.encode(), engine,
            self.template, self.plugin, '')

    def test_accepts_legacy_defer_and_body_config_execution_prerequisite(self):
        self.check(self.legacy, 'legacy')

    def test_accepts_candidate_blocking_config_before_all_modules(self):
        self.check(self.candidate)

    def test_only_indentation_whitespace_is_immaterial(self):
        self.check(self.candidate.replace('\n\t<head>', '\n    <head>'))
        with self.assertRaises(ValueError):
            self.check(self.candidate.replace('Beratung & Hilfe', 'Changed tenant title', 1))

    def test_rejects_wrong_missing_duplicate_or_wrongly_nested_root(self):
        for changed in [self.candidate.replace('id="appRoot"', 'id="wrongRoot"'),
                        self.candidate.replace('<main class="app" id="appRoot"></main>', ''),
                        self.candidate.replace('</body>', '<main class="app" id="appRoot"></main></body>'),
                        self.candidate.replace('<main class="app" id="appRoot"></main>', '<div><main class="app" id="appRoot"></main></div>')]:
            with self.subTest(change=changed[:60]), self.assertRaises(ValueError):
                self.check(changed)

    def test_rejects_extra_active_content_or_attributes(self):
        for fragment in ['<iframe src="https://foreign.invalid"></iframe>',
                         '<img src="x" onerror="alert(1)">', '<base href="https://foreign.invalid/">']:
            with self.subTest(fragment=fragment), self.assertRaises(ValueError):
                self.check(self.candidate.replace('</body>', fragment + '</body>'))
        with self.assertRaises(ValueError):
            self.check(self.candidate.replace('id="appRoot"', 'id="appRoot" id="other"'))

    def test_rejects_changed_canonical_comments_and_nonindentation_text(self):
        for changed in [self.candidate.replace('The app ships its own translations', 'Comment changed'),
                        self.candidate.replace('</body>', '\u00a0</body>')]:
            with self.subTest(change=changed[:60]), self.assertRaises(ValueError):
                self.check(changed)

    def test_rejects_missing_or_misordered_config(self):
        config = '<script src="/config.js"></script>'
        for changed in [self.candidate.replace(config, ''),
                        self.candidate.replace(config, '').replace('</body>', config + '</body>')]:
            with self.subTest(change=changed[:60]), self.assertRaises(ValueError):
                self.check(changed)

    def test_rejects_nonblocking_or_module_config(self):
        for attribute in ['async', 'defer', 'nomodule', 'type="module"']:
            with self.subTest(attribute=attribute), self.assertRaises(ValueError):
                self.check(self.candidate.replace('<script src="/config.js">', '<script ' + attribute + ' src="/config.js">'))

    def test_rejects_missing_unknown_foreign_or_extra_entry(self):
        for changed in [self.candidate.replace('/src/initApp.js', '/src/initError.js'),
                        self.candidate.replace('/src/initApp.js', 'https://foreign.invalid/app.js'),
                        self.candidate.replace('<script type="module" src="/src/initApp.js"></script>', ''),
                        self.candidate.replace('</body>', '<script src="/extra.js"></script></body>')]:
            with self.subTest(change=changed[:60]), self.assertRaises(ValueError):
                self.check(changed)

    def test_rejects_arbitrary_inline_script(self):
        with self.assertRaises(ValueError):
            self.check(self.candidate.replace('injectIntoGlobalHook(window);', 'injectIntoGlobalHook(window); alert(1);'))

    def test_rejects_non_deferred_legacy_app_before_config(self):
        with self.assertRaises(ValueError):
            self.check(self.legacy.replace('script defer', 'script'), 'legacy')

    def test_rejects_wrong_status_mime_and_cache(self):
        for response in [dict(status=500, headers={'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache'}),
                         dict(status=200, headers={'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache'}),
                         dict(status=200, headers={'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600'})]:
            with self.subTest(response=response), self.assertRaises(ValueError):
                check_shell(response, self.candidate.encode(), 'candidate', self.template, self.plugin, '')

    def test_rejects_unsupported_template_and_refresh_expressions(self):
        with self.assertRaises(ValueError):
            render_app_template(self.template + '<%= unknown %>', '')
        with self.assertRaises(ValueError):
            refresh_preamble(self.plugin.replace('const preambleCode =', 'const changed ='), '')

    def test_rejects_malformed_nesting_and_unreviewed_engine(self):
        with self.assertRaises(ValueError):
            Shell('<html><body><main></body></html>')
        with self.assertRaises(ValueError):
            self.check(self.candidate, 'unknown')


class MissingWorkerContract(unittest.TestCase):
    def setUp(self):
        self.candidate = dict(status=404, headers={'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store'})
        self.legacy = dict(status=404, headers={'content-type': 'text/html; charset=utf-8',
            'content-security-policy': "default-src 'none'", 'x-content-type-options': 'nosniff'})
        self.body = b'<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot GET /brand/service-worker.js</pre>\n</body>\n</html>\n'

    def test_exact_two_inert_representations_and_original_path_without_query(self):
        check_missing_worker(self.candidate, b'Not found', 'candidate', '/brand/service-worker.js?v=1')
        check_missing_worker(self.legacy, self.body, 'legacy', '/brand/service-worker.js?v=1')

    def test_rejects_unsafe_or_substituted_body(self):
        for body in [b'Not found\n', b'<script>alert(1)</script>', b'self.addEventListener("install",()=>{})']:
            with self.subTest(body=body), self.assertRaises(ValueError):
                check_missing_worker(self.candidate, body, 'candidate', '/service-worker.js?v=1')
        with self.assertRaises(ValueError):
            check_missing_worker(self.legacy, self.body.replace(b'</body>', b'<script>alert(1)</script></body>'), 'legacy', '/brand/service-worker.js')

    def test_rejects_wrong_status_mime_cache_and_legacy_security(self):
        for engine, original, body, changes in [
            ('candidate', self.candidate, b'Not found', {'status': 200}),
            ('candidate', self.candidate, b'Not found', {'headers': {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store'}}),
            ('candidate', self.candidate, b'Not found', {'headers': {'content-type': 'text/plain; charset=utf-8'}}),
            ('legacy', self.legacy, self.body, {'headers': {'content-type': 'text/html; charset=utf-8'}})]:
            with self.subTest(engine=engine, changes=changes), self.assertRaises(ValueError):
                check_missing_worker({**original, **changes}, body, engine, '/brand/service-worker.js')

    def test_conforming_variants_do_not_relabel_or_mutate_raw_inequality(self):
        legacy = {**self.legacy, 'decodedSHA256': digest(self.body)}
        candidate = {**self.candidate, 'decodedSHA256': digest(b'Not found')}
        fields = ['status', 'content-type', 'decodedSHA256']
        def view(response):
            return {key: response['headers'][key] if key == 'content-type' else response[key] for key in fields}
        left, right = view(legacy), view(candidate)
        raw = dict(axis='service-worker', legacy=left, candidate=right, equal=False,
            differences={key: {'legacy': left[key], 'candidate': right[key]} for key in fields if left[key] != right[key]})
        before = json.dumps(raw, sort_keys=True)
        require_raw_pair(raw, {'axis': 'service-worker'}, legacy, candidate, {})
        check_missing_worker(legacy, self.body, 'legacy', '/brand/service-worker.js')
        check_missing_worker(candidate, b'Not found', 'candidate', '/brand/service-worker.js')
        self.assertFalse(raw['equal'])
        self.assertEqual(json.dumps(raw, sort_keys=True), before)


class InventoryContract(unittest.TestCase):
    def test_variant_membership_is_request_derived_and_id_independent(self):
        matrix = json.loads((HERE / 'matrix.json').read_text())['scenarios']
        counts = {}
        for scenario in matrix:
            for request in scenario['requests']:
                kind = variant(scenario, request)
                counts[kind] = counts.get(kind, 0) + 1
                self.assertEqual(variant(scenario, {**request, 'id': 'unrelated-name'}), kind)
        self.assertEqual(counts, {'strict-comparison': 78, 'canonical-app-shell': 3, 'safe-missing-worker': 3})

    def test_no_generic_html_or_404_variant(self):
        scenario = dict(base='', packageProxy=False)
        request = dict(method='GET', axis='service-worker', legacyPath='/arbitrary.js', candidatePath='/arbitrary.js', accept='*/*')
        self.assertEqual(variant(scenario, request), 'strict-comparison')
        with self.assertRaises(ValueError):
            variant({**scenario, 'base': '/unreviewed'}, request)

    def test_new_difference_in_previously_equal_pair_cannot_be_claimed_equal(self):
        request = dict(axis='cors')
        response = dict(status=200, headers={'access-control-allow-origin': '*'})
        fields = dict(status=200, **{'access-control-allow-origin': '*', 'access-control-allow-methods': None, 'access-control-allow-headers': None})
        raw = dict(axis='cors', legacy=fields, candidate=fields, differences={}, equal=True)
        require_raw_pair(raw, request, response, response, {})
        with self.assertRaises(ValueError):
            require_raw_pair(raw, request, response, {**response, 'status': 500}, {})

    def test_missing_duplicate_foreign_identity_and_hash_are_rejected(self):
        request = dict(id='source', method='GET', axis='cors', legacyPath='/old.js', candidatePath='/new.js')
        scenario = dict(requests=[request])
        row = dict(**request, engine='candidate', requestPath='/new.js', wireSHA256=digest(b'x'), decodedSHA256=digest(b'x'), wireBytes=1, decodedBytes=1,
            headers={}, requestHeaders={'Connection': 'close', 'Accept': '*/*', 'Accept-Encoding': 'identity', 'X-Parity-Case': 'source'})
        with TemporaryDirectory() as temporary:
            directory = Path(temporary)
            (directory / 'process.json').write_text(json.dumps(dict(terminal=True, naturalExit=True, exitCode=0, forcedSafetyCleanup=False)))
            (directory / 'observation-complete.json').write_text('{"executed":1}')
            (directory / 'port-release.json').write_text('{"port":true,"stubPort":true}')
            (directory / 'source.wire').write_bytes(b'x')
            (directory / 'source.decoded').write_bytes(b'x')
            (directory / 'responses.json').write_text(json.dumps([row]))
            self.assertEqual(set(response_inventory(directory, scenario, 'candidate')), {'source'})
            for rows in [[], [row, row], [{**row, 'id': 'foreign'}], [{**row, 'method': 'POST'}], [{**row, 'decodedSHA256': 'wrong'}], [{**row, 'requestHeaders': {**row['requestHeaders'], 'Accept': 'text/html'}}]]:
                (directory / 'responses.json').write_text(json.dumps(rows))
                with self.subTest(rows=rows), self.assertRaises(ValueError):
                    response_inventory(directory, scenario, 'candidate')

    def test_identity_and_gzip_bind_decoded_bytes_to_wire_not_just_independent_hashes(self):
        request = dict(id='source', method='GET', axis='cors', legacyPath='/old.js', candidatePath='/new.js')
        with TemporaryDirectory() as temporary:
            directory = Path(temporary)
            (directory / 'process.json').write_text(json.dumps(dict(terminal=True, naturalExit=True, exitCode=0, forcedSafetyCleanup=False)))
            (directory / 'observation-complete.json').write_text('{"executed":1}')
            (directory / 'port-release.json').write_text('{"port":true,"stubPort":true}')
            def record(wire, decoded, encoding):
                row = dict(**request, engine='candidate', requestPath='/new.js', wireSHA256=digest(wire), decodedSHA256=digest(decoded),
                    wireBytes=len(wire), decodedBytes=len(decoded), headers={'content-encoding': encoding},
                    requestHeaders={'Connection': 'close', 'Accept': '*/*', 'Accept-Encoding': 'identity', 'X-Parity-Case': 'source'})
                (directory / 'source.wire').write_bytes(wire)
                (directory / 'source.decoded').write_bytes(decoded)
                (directory / 'responses.json').write_text(json.dumps([row]))
            for encoding, wire in [('identity', b'actual'), ('gzip', gzip.compress(b'actual', mtime=0))]:
                record(wire, b'actual', encoding)
                self.assertEqual(set(response_inventory(directory, {'requests': [request]}, 'candidate')), {'source'})
                # Both stored hashes and sizes now match their own body, but the
                # substituted decoded body still has no relationship to the wire.
                record(wire, b'forged', encoding)
                with self.subTest(encoding=encoding), self.assertRaisesRegex(ValueError, 'does not match recorded wire'):
                    response_inventory(directory, {'requests': [request]}, 'candidate')
            for encoding in ['br', 'gzip']:
                record(b'not-compressed', b'not-compressed', encoding)
                with self.subTest(unsupported_or_invalid=encoding), self.assertRaises(ValueError):
                    response_inventory(directory, {'requests': [request]}, 'candidate')

    def test_forced_or_failed_cleanup_is_not_complete_observation(self):
        with TemporaryDirectory() as temporary:
            directory = Path(temporary)
            for change in [{'exitCode': 1}, {'naturalExit': False}, {'forcedSafetyCleanup': True}]:
                process = dict(terminal=True, naturalExit=True, exitCode=0, forcedSafetyCleanup=False)
                (directory / 'process.json').write_text(json.dumps({**process, **change}))
                with self.subTest(change=change), self.assertRaises(ValueError):
                    response_inventory(directory, dict(requests=[]), 'candidate')


if __name__ == '__main__':
    unittest.main(verbosity=2)
