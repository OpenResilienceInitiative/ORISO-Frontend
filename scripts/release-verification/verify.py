#!/usr/bin/env python3
"""Verify the already-published 2.0.15 artifacts without modifying them."""
import json
import subprocess

SOURCE = 'eb5adaaf5eced0c75565c17ca6e630c1aed647e8'
RELEASE_HEAD = '26de564fc9c86b645e587d442a8d5a249ac6f229'
REPOSITORY = 'OpenResilienceInitiative/ORISO-Frontend'
WORKFLOW = 'https://github.com/' + REPOSITORY + '/.github/workflows/release-image.yml@refs/heads/release/frontend-2.0.15'
IMAGES = {
    'oriso-frontend': 'sha256:07f6b05bfe3a2f6683a1d2ea292fcf357cef907881471f2ccdd31556a7ef5af0',
    'oriso-storybook': 'sha256:0dc8daefc2d02f6505a13e35d6b7545655a80b413c88874f4f4c76a937032e6f',
}


def run(*args):
    return subprocess.check_output(args, text=True).strip()


def verify():
    tag = run('git', 'rev-parse', 'refs/tags/v2.0.15^{commit}')
    if tag != SOURCE:
        raise ValueError('v2.0.15 tag does not resolve to the published source')
    run('git', 'merge-base', '--is-ancestor', SOURCE, RELEASE_HEAD)
    changed = run('git', 'diff', '--name-only', SOURCE, RELEASE_HEAD).splitlines()
    if changed != ['.github/workflows/pr-base-check.yml']:
        raise ValueError('release head includes a non-permitted change')
    actual_head = run('git', 'rev-parse', 'refs/release-proof/audited-2064^{commit}')
    if actual_head != RELEASE_HEAD:
        raise ValueError('audited release snapshot does not match the reviewed commit')
    print(f'Published release source: {SOURCE}\nAudited historical guard repair: {RELEASE_HEAD}\nThis historical audit does not validate the current pull request head or any later release.', flush=True)
    for name, digest in IMAGES.items():
        image = f'ghcr.io/openresilienceinitiative/{name}'
        actual = run('docker', 'buildx', 'imagetools', 'inspect', image + ':2.0.15', '--format', '{{.Manifest.Digest}}')
        if actual != digest:
            raise ValueError(f'{name} registry digest differs from published release')
        verified = json.loads(run('gh', 'attestation', 'verify', f'oci://{image}@{digest}', '--repo', REPOSITORY, '--format', 'json'))
        if not verified:
            raise ValueError(f'{name} has no verified provenance')
        for item in verified:
            cert = item['verificationResult']['signature']['certificate']
            if cert.get('sourceRepositoryDigest') == SOURCE and cert.get('sourceRepositoryURI') == 'https://github.com/' + REPOSITORY and cert.get('subjectAlternativeName') == WORKFLOW:
                break
        else:
            raise ValueError(f'{name} provenance does not identify the published source and workflow')
        print(f'{name}: {digest} verified against published source', flush=True)


if __name__ == '__main__':
    verify()
