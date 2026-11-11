#!/usr/bin/env python3
"""Fail closed before publishing, or verify the immutable 2.0.15 release."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys

REPOSITORY = 'OpenResilienceInitiative/ORISO-Frontend'
SOURCE = 'eb5adaaf5eced0c75565c17ca6e630c1aed647e8'
BASE_CHECK_BLOB = '64e5fe58545bfaeedc959b5c2078cca6074d708d'
WORKFLOW = 'https://github.com/' + REPOSITORY + '/.github/workflows/release-image.yml@refs/heads/release/frontend-2.0.15'
IMAGES = {
    'oriso-frontend': 'sha256:07f6b05bfe3a2f6683a1d2ea292fcf357cef907881471f2ccdd31556a7ef5af0',
    'oriso-storybook': 'sha256:0dc8daefc2d02f6505a13e35d6b7545655a80b413c88874f4f4c76a937032e6f',
}
BASE_CHECK = '.github/workflows/pr-base-check.yml'
ALLOWED = {
    BASE_CHECK,
    '.github/workflows/release-image.yml',
    '.github/scripts/release-publisher/guard.py',
    '.github/scripts/release-publisher/test_guard.py',
}


def run(*args, cwd=None):
    return subprocess.check_output(args, cwd=cwd, text=True, stderr=subprocess.PIPE).strip()


def remote_tag(repo, version):
    ref = f'refs/tags/v{version}'
    result = subprocess.run(['git', 'ls-remote', '--exit-code', '--tags', 'origin', ref],
                            cwd=repo, capture_output=True, text=True, check=False)
    if result.returncode == 2:
        return None
    if result.returncode != 0:
        raise RuntimeError('Could not check the remote release tag')
    rows = [line.split() for line in result.stdout.splitlines()]
    if len(rows) != 1 or len(rows[0]) != 2 or rows[0][1] != ref or not re.fullmatch(r'[0-9a-f]{40}', rows[0][0]):
        raise ValueError('Unexpected remote tag response')
    return rows[0][0]


def verify_release_tag(repo, remote_object):
    ref = 'refs/tags/v2.0.15'
    run('git', 'fetch', '--no-tags', 'origin', f'{ref}:{ref}', cwd=repo)
    if run('git', 'rev-parse', ref, cwd=repo) != remote_object:
        raise ValueError('Fetched release tag differs from the remote tag')
    if run('git', 'rev-parse', f'{ref}^{{commit}}', cwd=repo) != SOURCE:
        raise ValueError('Release tag does not identify the published source')


def verify_tree(repo, source, head, expected_base_blob=BASE_CHECK_BLOB):
    if subprocess.run(['git', 'merge-base', '--is-ancestor', source, head], cwd=repo,
                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False).returncode != 0:
        raise ValueError('Release source is not an ancestor of the candidate')
    raw = subprocess.check_output(['git', 'diff', '--name-status', '-z', '--no-renames', source, head, '--'], cwd=repo)
    fields = raw.split(b'\0')
    if fields[-1] != b'':
        raise ValueError('Malformed tree diff')
    fields.pop()
    if len(fields) % 2:
        raise ValueError('Malformed tree diff')
    changed = []
    for i in range(0, len(fields), 2):
        status = fields[i].decode('ascii')
        path = fields[i + 1].decode('utf-8')
        if status not in ('A', 'M') or path not in ALLOWED:
            raise ValueError('Release candidate contains a non-permitted change')
        entry = subprocess.check_output(['git', 'ls-tree', '-z', head, '--', path], cwd=repo)
        metadata, separator, entry_path = entry.rstrip(b'\0').partition(b'\t')
        if not separator or entry_path.decode('utf-8') != path or metadata.split(b' ')[0] != b'100644':
            raise ValueError('Release maintenance file must be a regular file')
        changed.append(path)
    if BASE_CHECK in changed and run('git', 'rev-parse', f'{head}:{BASE_CHECK}', cwd=repo) != expected_base_blob:
        raise ValueError('Base-check correction differs from the known maintenance change')
    return changed


def verify_images():
    for name, digest in IMAGES.items():
        image = f'ghcr.io/openresilienceinitiative/{name}'
        actual = run('docker', 'buildx', 'imagetools', 'inspect', image + ':2.0.15', '--format', '{{.Manifest.Digest}}')
        if actual != digest:
            raise ValueError(f'{name} registry digest does not match the published release')
        verified = json.loads(run('gh', 'attestation', 'verify', f'oci://{image}@{digest}', '--repo', REPOSITORY, '--format', 'json'))
        if not isinstance(verified, list):
            raise ValueError(f'{name} provenance response is invalid')
        matches = []
        for item in verified:
            result = item.get('verificationResult') if isinstance(item, dict) else None
            if not isinstance(result, dict):
                continue
            signature = result.get('signature')
            statement = result.get('statement')
            cert = signature.get('certificate') if isinstance(signature, dict) else None
            subjects = statement.get('subject') if isinstance(statement, dict) else None
            if not isinstance(cert, dict) or not isinstance(subjects, list):
                continue
            subject_matches = any(
                isinstance(subject, dict) and subject.get('name') == image and
                isinstance(subject.get('digest'), dict) and
                subject['digest'].get('sha256') == digest.removeprefix('sha256:')
                for subject in subjects
            )
            matches.append(subject_matches and
                           cert.get('sourceRepositoryDigest') == SOURCE and
                           cert.get('sourceRepositoryURI') == 'https://github.com/' + REPOSITORY and
                           cert.get('subjectAlternativeName') == WORKFLOW)
        if not any(matches):
            raise ValueError(f'{name} provenance does not identify the original release')


def classify(version, repo, head):
    tag = remote_tag(repo, version)
    if tag is None:
        if version == '2.0.15':
            raise ValueError('Published 2.0.15 tag is missing; refusing to publish')
        return 'publish'
    if version != '2.0.15':
        raise ValueError('Existing tag has no reviewed immutable artifact policy')
    verify_release_tag(repo, tag)
    verify_tree(repo, SOURCE, head)
    verify_images()
    if remote_tag(repo, version) != tag:
        raise ValueError('Release tag changed during verification')
    return 'verify_existing'


def verify_current_branch(branch, head):
    remote_head = run('git', 'ls-remote', '--exit-code', '--heads', 'origin', f'refs/heads/{branch}').split()
    if remote_head != [head, f'refs/heads/{branch}']:
        raise ValueError('Release branch moved after this run started')


def main():
    command, version = sys.argv[1:]
    if not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+', version):
        raise ValueError('Invalid release version')
    if command == 'assert-absent':
        if version == '2.0.15':
            raise ValueError('Published 2.0.15 must never enter the publish path')
        branch = os.environ['GITHUB_REF_NAME']
        if branch != f'release/frontend-{version}':
            raise ValueError('Release branch does not match the version')
        verify_current_branch(branch, os.environ['GITHUB_SHA'])
        if remote_tag('.', version) is not None:
            raise ValueError('Release tag already exists; no write was attempted')
        return
    if command != 'classify':
        raise ValueError('Unknown guard operation')
    head = run('git', 'rev-parse', 'HEAD')
    if head != os.environ['GITHUB_SHA']:
        raise ValueError('Checkout does not match the event commit')
    branch = os.environ['GITHUB_REF_NAME']
    if branch != f'release/frontend-{version}':
        raise ValueError('Release branch does not match the version')
    verify_current_branch(branch, head)
    mode = classify(version, '.', head)
    verify_current_branch(branch, head)
    with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as output:
        output.write(f'mode={mode}\n')
        if mode == 'verify_existing':
            output.write(f'source={SOURCE}\n')
            output.write(f'frontend_digest={IMAGES["oriso-frontend"]}\n')
            output.write(f'storybook_digest={IMAGES["oriso-storybook"]}\n')
    print('Release disposition:', mode)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, RuntimeError, KeyError, OSError, subprocess.CalledProcessError, json.JSONDecodeError) as error:
        print(f'Release guard failed: {type(error).__name__}: {error if isinstance(error, (ValueError, RuntimeError)) else "verification unavailable"}', file=sys.stderr)
        sys.exit(1)
