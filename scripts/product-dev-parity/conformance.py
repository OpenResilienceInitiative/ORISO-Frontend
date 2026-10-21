"""Request-specific middleware contracts; raw comparison is never rewritten."""
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import argparse
import gzip
import hashlib
import json
import re
import zlib


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def variant(scenario, request):
    """Select from the intended request, never from an observed mismatch or ID."""
    base = scenario['base']
    require(base in ['', '/brand'], 'Unknown base')
    if request['method'] != 'GET':
        return 'strict-comparison'
    left, right = request['legacyPath'], request['candidatePath']
    if left != right:
        return 'strict-comparison'
    path = urlsplit(left)
    if request['axis'] == 'service-worker' and not scenario['packageProxy']:
        own_worker = path.path == base + '/service-worker.js'
        if base == '' and own_worker and request.get('accept') == '*/*':
            return 'canonical-app-shell'
        if request.get('accept') == 'application/javascript' and (
            (own_worker and path.query != '')
            or (base == '' and left == '/brand/service-worker.js')
        ):
            return 'safe-missing-worker'
    if (request['axis'] == 'package-proxy' and scenario['packageProxy']
            and base == '' and left == '/unclaimed/proxy-probe?x=1'
            and request.get('accept') == 'text/html'):
        return 'canonical-app-shell'
    return 'strict-comparison'


class Shell(HTMLParser):
    """Keep the canonical tree/text/comments, with scripts checked separately."""
    VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
            'link', 'meta', 'param', 'source', 'track', 'wbr'}

    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.tree, self.scripts, self.stack = [], [], []
        self.script = None
        self.feed(source)
        self.close()
        require(not self.stack and self.script is None, 'Unclosed HTML element')

    def handle_decl(self, declaration):
        require(not self.stack and declaration.lower() == 'doctype html', 'Unknown declaration')
        self.tree.append(('doctype', 'html'))

    def handle_starttag(self, tag, attributes):
        require(len(attributes) == len({key for key, _ in attributes}), 'Duplicate attribute')
        require(self.script is None, 'Nested executable element')
        attributes = tuple(attributes)
        if tag == 'script':
            self.script = dict(attrs=attributes, parent=tuple(self.stack), text='')
        else:
            self.tree.append(('open', tag, attributes))
        if tag not in self.VOID:
            self.stack.append(tag)

    def handle_startendtag(self, tag, attributes):
        require(tag in self.VOID, 'Unexpected self-closing element')
        self.handle_starttag(tag, attributes)

    def handle_endtag(self, tag):
        require(self.stack and self.stack[-1] == tag, 'Mismatched HTML nesting')
        self.stack.pop()
        if tag == 'script':
            self.scripts.append(self.script)
            self.script = None
        else:
            self.tree.append(('close', tag))

    def handle_data(self, text):
        if self.script is not None:
            self.script['text'] += text
        elif text and any(character not in ' \t\r\n' for character in text):
            self.tree.append(('text', text))

    def handle_comment(self, text):
        require(self.script is None, 'Unexpected script comment')
        self.tree.append(('comment', text))

    def unknown_decl(self, declaration):
        raise ValueError('Unknown HTML declaration: ' + declaration)

    def handle_pi(self, data):
        raise ValueError('Unexpected processing instruction')


def render_app_template(source, base):
    # This is deliberately not a permissive template interpreter. A new template
    # construct requires a reviewed contract update, not a best-effort rendering.
    conditional = r"<% if\(type === 'error'\) \{ %>[\s\S]*?<% \} else \{ %>([\s\S]*?)<% \} %>"
    source, count = re.subn(conditional, lambda match: match[1], source)
    require(count == 1, 'Unknown canonical app conditional')
    source = source.replace('<%= htmlWebpackPlugin.options.title %>', 'Beratung & Hilfe')
    source = source.replace('<%= type %>', 'app').replace('%PUBLIC_URL%', base)
    require('<%' not in source and '%PUBLIC_URL%' not in source, 'Unresolved canonical template')
    return source


def refresh_preamble(source, base):
    path = re.search(r'const runtimePublicPath = "([^"]+)";', source)
    code = re.search(r'const preambleCode = `([^`]+)`;', source)
    require(path is not None and code is not None, 'Unknown pinned refresh source')
    require(path[1] == '/@react-refresh', 'Unexpected refresh entry')
    text = code[1].replace('${runtimePublicPath.slice(1)}', path[1][1:])
    require('${' not in text and text.count('__BASE__') == 1, 'Unknown refresh expression')
    return text.replace('__BASE__', base + '/')


def script(attrs, parent, text=''):
    return dict(attrs=tuple(attrs), parent=('html', parent), text=text)


def check_shell(response, body, engine, template, plugin, base):
    require(response['status'] == 200, 'Shell status must be 200')
    require(response['headers'].get('content-type') == 'text/html; charset=utf-8', 'Shell MIME')
    require(base == '', 'Unreviewed shell base variant')
    expected = Shell(render_app_template(template, base))
    require(expected.scripts == [script([('src', '/config.js')], 'body')], 'Unknown canonical script slot')
    actual = Shell(body.decode('utf-8', errors='strict'))
    require(actual.tree == expected.tree, 'Canonical shell tree/text/comments differ')
    if engine == 'legacy':
        wanted = [script([('defer', None), ('src', '/static/js/app.bundle.js')], 'head'),
                  script([('src', '/config.js')], 'body')]
        # A classic blocking body config executes before the deferred app bundle.
    elif engine == 'candidate':
        require(response['headers'].get('cache-control') == 'no-cache', 'Shell cache')
        wanted = [script([('src', '/config.js')], 'head'),
                  script([('type', 'module')], 'head', refresh_preamble(plugin, base)),
                  script([('type', 'module'), ('src', '/@vite/client')], 'head'),
                  script([('type', 'module'), ('src', '/src/initApp.js')], 'body')]
    else:
        raise ValueError('Unknown shell engine')
    require(actual.scripts == wanted, 'Unexpected script shape/order/inline code')


def check_missing_worker(response, body, engine, request_path):
    require(response['status'] == 404, 'Missing worker status must be 404')
    headers = response['headers']
    if engine == 'candidate':
        require(headers.get('content-type') == 'text/plain; charset=utf-8', '404 MIME')
        require(headers.get('cache-control') == 'no-store', '404 must be no-store')
        require(body == b'Not found', '404 exact inert text')
    elif engine == 'legacy':
        require(headers.get('content-type') == 'text/html; charset=utf-8', 'Legacy 404 MIME')
        require(headers.get('content-security-policy') == "default-src 'none'", 'Legacy 404 CSP')
        require(headers.get('x-content-type-options') == 'nosniff', 'Legacy 404 nosniff')
        pathname = urlsplit(request_path).path
        require(re.fullmatch(r'/[A-Za-z0-9_./-]+', pathname) is not None, 'Unknown error pathname')
        # Exact pinned finalhandler document; getResourceName uses original pathname.
        wanted = ('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
                  '<title>Error</title>\n</head>\n<body>\n<pre>Cannot GET '
                  + escape(pathname) + '</pre>\n</body>\n</html>\n').encode()
        require(body == wanted, 'Legacy 404 exact inert document')
    else:
        raise ValueError('Unknown 404 engine')


def read_json(file):
    return json.loads(file.read_text())


def response_inventory(directory, scenario, engine):
    process = read_json(directory / 'process.json')
    require(process.get('terminal') is True and process.get('naturalExit') is True
            and process.get('exitCode') == 0 and process.get('forcedSafetyCleanup') is False,
            'Leg did not complete naturally')
    require(read_json(directory / 'observation-complete.json')['executed'] == len(scenario['requests']), 'Leg observations incomplete')
    require(read_json(directory / 'port-release.json') == {'port': True, 'stubPort': True}, 'Leg ports not released')
    rows = read_json(directory / 'responses.json')
    expected = {request['id']: request for request in scenario['requests']}
    require(len(rows) == len(expected) == len(scenario['requests']), 'Response count/duplicate request')
    require({row['id'] for row in rows} == set(expected), 'Missing/duplicate/foreign response')
    result = {}
    for row in rows:
        request = expected[row['id']]
        require(all(row.get(key) == value for key, value in request.items()), 'Response request identity differs')
        require(row['engine'] == engine and row['requestPath'] == request[engine + 'Path'], 'Response engine/path differs')
        headers = {'Connection': 'close', 'Accept': request.get('accept', '*/*'),
                   'Accept-Encoding': request.get('encoding', 'identity'), 'X-Parity-Case': request['id']}
        if request.get('origin'):
            headers['Origin'] = request['origin']
        if request.get('host'):
            headers['Host'] = request['host']
        if request['method'] == 'OPTIONS':
            headers.update({'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'X-Parity-Probe'})
        require(row['requestHeaders'] == headers, 'Actual request headers differ')
        bodies = {}
        for suffix, key in [('wire', 'wireSHA256'), ('decoded', 'decodedSHA256')]:
            data = (directory / (row['id'] + '.' + suffix)).read_bytes()
            require(digest(data) == row[key] and len(data) == row[suffix + 'Bytes'], 'Body hash/size differs')
            bodies[suffix] = data
        encoding = row['headers'].get('content-encoding', 'identity')
        require(encoding in ['identity', 'gzip'], 'Unsupported observed content encoding')
        try:
            decoded_wire = gzip.decompress(bodies['wire']) if encoding == 'gzip' else bodies['wire']
        except (OSError, EOFError, zlib.error) as error:
            raise ValueError('Invalid recorded gzip wire body') from error
        require(decoded_wire == bodies['decoded'], 'Decoded body does not match recorded wire bytes')
        result[row['id']] = row
    return result


def check_controls(scenario, legs, fixture):
    controls = []
    if scenario['packageProxy']:
        return controls
    asset = digest(fixture['syntheticFiles']['public/parity-large.txt'].encode())
    for engine in ['legacy', 'candidate']:
        data = legs[engine]
        controls.append(dict(scenario=scenario['id'], engine=engine,
            control='large-public-exact-decoded-identity+gzip', passed=all(
                data['compression-public-' + encoding]['status'] == 200
                and data['compression-public-' + encoding]['decodedSHA256'] == asset
                for encoding in ['identity', 'gzip'])))
        controls.append(dict(scenario=scenario['id'], engine=engine,
            control='html-gzip-preserves-own-identity-body', passed=(
                data['compression-html-gzip']['status'] == data['compression-html-identity']['status'] == 200
                and data['compression-html-gzip']['decodedSHA256'] == data['compression-html-identity']['decodedSHA256'])))
        if engine == 'legacy':
            controls.append(dict(scenario=scenario['id'], engine=engine,
                control='large-public-really-gzip-compressed-baseline',
                passed=data['compression-public-gzip']['headers'].get('content-encoding') == 'gzip'))
    return controls


def require_raw_pair(row, request, left, right, bodies):
    fields = ['status']
    axis = request['axis']
    if axis == 'cors':
        fields += ['access-control-allow-origin', 'access-control-allow-methods', 'access-control-allow-headers']
    elif axis == 'compression':
        fields += ['content-encoding', 'vary']
    elif axis == 'redirect':
        fields += ['location', 'content-type']
    elif axis in ['service-worker', 'package-proxy']:
        fields += ['content-type', 'decodedSHA256']
    else:
        require(axis == 'host', 'Unknown comparison axis')
    def values(response):
        return {field: response[field] if field in ['status', 'decodedSHA256']
                else response['headers'].get(field) for field in fields}
    a, b = values(left), values(right)
    differences = {field: dict(legacy=a[field], candidate=b[field]) for field in fields if a[field] != b[field]}
    if axis == 'host':
        def accepted(response, body):
            if request['routeClass'] == 'owned-settings':
                try:
                    return response['status'] == 200 and json.loads(body).get('proxyPath') == '/p'
                except (ValueError, AttributeError):
                    return False
            return response['status'] == 200 and response['containsAppEntryMarker']
        first, second = accepted(left, bodies['legacy']), accepted(right, bodies['candidate'])
        if first != second:
            differences['acceptedByRealRoute'] = dict(legacy=first, candidate=second)
    require(row['axis'] == axis and row['legacy'] == a and row['candidate'] == b
            and row['differences'] == differences and row['equal'] == (not differences), 'Raw comparison differs from actual responses')


def evaluate(execution, scenarios, fixture, comparison, repository):
    """Read only; callers persist the separate outcome, never mutate comparison."""
    execution, repository = Path(execution), Path(repository)
    result = dict(status='FAIL', observationsComplete=False, expectedPairs=84,
                  executedPairs=0, expectedResponses=168, observedResponses=0,
                  variantCounts={}, rows=[], failures=[], scope='minimal-entry middleware only; full product/Dev OPEN',
                  finalControllerAcceptance='not determined here; actual exit0 and final source/cache/process guards required')
    try:
        require(len(scenarios) == 4 and [len(s['requests']) for s in scenarios] == [32, 10, 32, 10], 'Unknown scenario inventory')
        expected = {(s['id'], r['id']) for s in scenarios for r in s['requests']}
        require(len(expected) == 84, 'Duplicate request membership')
        raw = {(r['scenario'], r['case']): r for r in comparison['rows']}
        require(len(comparison['rows']) == len(raw) == 84 and set(raw) == expected, 'Raw comparison membership')
        require(comparison['pairedCases'] == 84 and comparison['observedResponses'] == 168, 'Raw comparison counts')
        require(len(comparison['controls']) == 10 and all(c['passed'] is True for c in comparison['controls'])
                and comparison['controlFailures'] == 0, 'Existing comparison control failed')
        require(comparison['unequalPairs'] == sum(not r['equal'] for r in raw.values()), 'Raw unequal count')
        template = (repository / 'src/pages/app.html').read_text().replace('</body>', fixture['htmlPadding'] + '\n</body>')
        plugin_path = repository / 'node_modules/@vitejs/plugin-react/dist/index.js'
        plugin = plugin_path.read_text()
        inputs = [repository / 'src/pages/app.html', plugin_path, repository / 'node_modules/finalhandler/index.js', repository / 'package-lock.json']
        result['sourceInputs'] = {str(file.relative_to(repository)): digest(file.read_bytes()) for file in inputs}
        actual_controls = []
        for scenario in scenarios:
            legs = {engine: response_inventory(execution / scenario['id'] / engine, scenario, engine)
                    for engine in ['legacy', 'candidate']}
            actual_controls += check_controls(scenario, legs, fixture)
            result['observedResponses'] += sum(len(rows) for rows in legs.values())
            for request in scenario['requests']:
                kind = variant(scenario, request)
                row = dict(scenario=scenario['id'], case=request['id'], variant=kind, passed=False, failures=[])
                result['variantCounts'][kind] = result['variantCounts'].get(kind, 0) + 1
                try:
                    a, b = (legs[engine][request['id']] for engine in ['legacy', 'candidate'])
                    bodies = {engine: (execution / scenario['id'] / engine / (request['id'] + '.decoded')).read_bytes()
                              for engine in ['legacy', 'candidate']}
                    require_raw_pair(raw[(scenario['id'], request['id'])], request, a, b, bodies)
                    if kind == 'strict-comparison':
                        require(raw[(scenario['id'], request['id'])]['equal'] is True, 'Strict comparison pair differs')
                    else:
                        cors = ['access-control-allow-origin', 'access-control-allow-methods', 'access-control-allow-headers']
                        require(all(a['headers'].get(key) == b['headers'].get(key) for key in cors), 'Variant CORS differs')
                        for engine, response in [('legacy', a), ('candidate', b)]:
                            if kind == 'canonical-app-shell':
                                archived = execution / scenario['id'] / engine / 'fixture-archive/src/pages/app.html'
                                require(archived.read_text() == template, 'Canonical fixture template differs')
                                check_shell(response, bodies[engine], engine, template, plugin, scenario['base'])
                            elif kind == 'safe-missing-worker':
                                check_missing_worker(response, bodies[engine], engine, request[engine + 'Path'])
                            else:
                                raise ValueError('Unknown response variant')
                    row['passed'] = True
                except (ValueError, KeyError, OSError, UnicodeError) as error:
                    row['failures'].append(str(error))
                result['rows'].append(row)
                result['executedPairs'] += 1
        require(result['variantCounts'] == {'strict-comparison': 78, 'canonical-app-shell': 3, 'safe-missing-worker': 3}, 'Unexpected variant membership')
        require(actual_controls == comparison['controls'] and all(row['passed'] is True for row in actual_controls), 'Actual ten controls differ/fail')
        require(result['executedPairs'] == 84 and result['observedResponses'] == 168, 'Incomplete semantic observations')
        result['observationsComplete'] = True
        result['status'] = 'PASS' if all(row['passed'] for row in result['rows']) else 'FAIL'
    except (ValueError, KeyError, OSError, UnicodeError) as error:
        result['failures'].append(str(error))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execution', type=Path, required=True)
    parser.add_argument('--source-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    require(not args.output.exists(), 'Refuse existing conformance output')
    require(not args.output.resolve().is_relative_to(args.execution.resolve()), 'Replay must not modify retained evidence')
    here = Path(__file__).resolve().parent
    result = evaluate(args.execution, read_json(here / 'matrix.json')['scenarios'],
                      read_json(here / 'fixture-plan.json'), read_json(args.execution / 'comparison.json'), args.source_root)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({key: result[key] for key in ['status', 'observationsComplete', 'executedPairs', 'observedResponses', 'variantCounts', 'failures']}))
    return 0 if result['status'] == 'PASS' and result['observationsComplete'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
