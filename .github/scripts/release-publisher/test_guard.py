import importlib.util
import json
import re
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import os

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('release_guard', HERE / 'guard.py')
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


def attestation(cert, image, digest):
    return {'verificationResult': {'signature': {'certificate': cert}, 'statement': {
        'subject': [{'name': image, 'digest': {'sha256': digest.removeprefix('sha256:')}}]
    }}}


def git(repo, *args):
    return subprocess.check_output(['git', '-C', str(repo), *args], text=True).strip()


class TreeBoundary(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self.tmp.name)
        git(self.repo, 'init', '-q')
        git(self.repo, 'config', 'user.email', 'fixture@example.invalid')
        git(self.repo, 'config', 'user.name', 'Fixture')
        self.write('.github/workflows/pr-base-check.yml', 'before\n')
        self.write('.github/workflows/release-image.yml', 'old publisher\n')
        self.write('src/app.ts', 'original product\n')
        git(self.repo, 'add', '.')
        git(self.repo, 'commit', '-qm', 'published source')
        self.source = git(self.repo, 'rev-parse', 'HEAD')
        git(self.repo, 'tag', '-a', 'v2.0.15', '-m', 'fixture')
        self.write('.github/workflows/pr-base-check.yml', 'approved base check\n')
        self.blob = git(self.repo, 'hash-object', str(self.repo / '.github/workflows/pr-base-check.yml'))
        self.write('.github/workflows/release-image.yml', 'guarded publisher\n')
        self.write('.github/scripts/release-publisher/guard.py', '# guard\n')
        self.write('.github/scripts/release-publisher/test_guard.py', '# tests\n')
        git(self.repo, 'add', '.')
        git(self.repo, 'commit', '-qm', 'maintenance only')
        self.maintenance = git(self.repo, 'rev-parse', 'HEAD')

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, name, data):
        path = self.repo / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(data)

    def commit(self):
        git(self.repo, 'add', '-A')
        git(self.repo, 'commit', '-qm', 'candidate change')
        return git(self.repo, 'rev-parse', 'HEAD')

    def verify(self, head=None, blob=None):
        return guard.verify_tree(self.repo, self.source, head or self.maintenance, blob or self.blob)

    def test_exact_source_and_maintenance_tree_are_permitted(self):
        self.verify(self.source)
        self.verify()

    def test_product_and_unlisted_config_fail(self):
        for filename in ['src/app.ts', 'package-lock.json']:
            with self.subTest(filename=filename):
                self.write(filename, 'changed\n')
                head = self.commit()
                with self.assertRaises(ValueError): self.verify(head)
                git(self.repo, 'reset', '--hard', self.maintenance)

    def test_wrong_base_check_blob_fails(self):
        with self.assertRaises(ValueError): self.verify(blob='0' * 40)

    def test_deletion_rename_and_symlink_fail(self):
        for change in ['delete', 'rename', 'symlink']:
            with self.subTest(change=change):
                p = self.repo / '.github/workflows/pr-base-check.yml'
                if change == 'delete': p.unlink()
                elif change == 'rename': p.rename(p.with_name('other.yml'))
                else: p.unlink(); p.symlink_to('../../src/app.ts')
                head = self.commit()
                with self.assertRaises(ValueError): self.verify(head)
                git(self.repo, 'reset', '--hard', self.maintenance)

    def test_non_ancestor_rejected(self):
        git(self.repo, 'checkout', '--orphan', 'unrelated')
        git(self.repo, 'commit', '--allow-empty', '-qm', 'other root')
        with self.assertRaises(ValueError): self.verify(git(self.repo, 'rev-parse', 'HEAD'))

    def test_real_annotated_remote_tag_and_missing_tag(self):
        git(self.repo, 'remote', 'add', 'origin', str(self.repo))
        self.assertEqual(guard.remote_tag(self.repo, '2.0.15'), git(self.repo, 'rev-parse', 'v2.0.15'))
        self.assertIsNone(guard.remote_tag(self.repo, '9.9.9'))
        with patch.object(guard, 'SOURCE', self.source):
            guard.verify_release_tag(self.repo, git(self.repo, 'rev-parse', 'v2.0.15'))
            with self.assertRaises(ValueError): guard.verify_release_tag(self.repo, '0' * 40)

    def test_tag_with_wrong_published_source_is_rejected(self):
        git(self.repo, 'remote', 'add', 'origin', str(self.repo))
        with patch.object(guard, 'SOURCE', self.maintenance):
            with self.assertRaisesRegex(ValueError, 'does not identify the published source'):
                guard.verify_release_tag(self.repo, git(self.repo, 'rev-parse', 'v2.0.15'))


class DecisionAndProof(unittest.TestCase):
    def test_absent_tag_publishes_but_lookup_errors_fail(self):
        with patch.object(guard, 'remote_tag', return_value=None):
            self.assertEqual(guard.classify('2.0.16', '/tmp', 'x'), 'publish')
            with self.assertRaises(ValueError): guard.classify('2.0.15', '/tmp', 'x')
        with patch.object(guard, 'remote_tag', side_effect=RuntimeError('network error')):
            with self.assertRaises(RuntimeError): guard.classify('1.2.3', '/tmp', 'x')

    def test_unknown_existing_version_fails(self):
        with patch.object(guard, 'remote_tag', return_value='some-object'):
            with self.assertRaises(ValueError): guard.classify('1.2.3', '/tmp', 'x')

    def test_existing_version_only_skips_after_tree_and_both_artifacts_verify(self):
        with patch.object(guard, 'remote_tag', return_value='tag-object'), patch.object(guard, 'verify_release_tag'), patch.object(guard, 'verify_tree'), patch.object(guard, 'verify_images') as images:
            self.assertEqual(guard.classify('2.0.15', '/tmp', 'candidate'), 'verify_existing')
            images.assert_called_once()
            images.side_effect = ValueError('invalid provenance')
            with self.assertRaises(ValueError): guard.classify('2.0.15', '/tmp', 'candidate')

    def test_tag_change_during_verification_fails_closed(self):
        with patch.object(guard, 'remote_tag', side_effect=['first-tag', 'other-tag']), patch.object(guard, 'verify_release_tag'), patch.object(guard, 'verify_tree'), patch.object(guard, 'verify_images'):
            with self.assertRaises(ValueError): guard.classify('2.0.15', '/tmp', 'candidate')

    def test_tag_recheck_blocks_publication_when_tag_appears(self):
        env = {'GITHUB_REF_NAME': 'release/frontend-2.0.16', 'GITHUB_SHA': '1' * 40}
        with patch.dict(os.environ, env), patch.object(guard, 'verify_current_branch'), patch.object(guard.sys, 'argv', ['guard.py', 'assert-absent', '2.0.16']), patch.object(guard, 'remote_tag', return_value='created-tag'):
            with self.assertRaises(ValueError): guard.main()
        with patch.dict(os.environ, env), patch.object(guard, 'verify_current_branch'), patch.object(guard.sys, 'argv', ['guard.py', 'assert-absent', '2.0.16']), patch.object(guard, 'remote_tag', return_value=None):
            guard.main()
        with patch.dict(os.environ, {'GITHUB_REF_NAME': 'release/frontend-2.0.15', 'GITHUB_SHA': '1' * 40}), patch.object(guard, 'verify_current_branch'), patch.object(guard.sys, 'argv', ['guard.py', 'assert-absent', '2.0.15']), patch.object(guard, 'remote_tag', return_value=None):
            with self.assertRaises(ValueError): guard.main()

    def test_registry_digest_and_signed_source_workflow_required(self):
        expected = next(iter(guard.IMAGES.values()))
        second = list(guard.IMAGES.values())[1]
        cert = {'sourceRepositoryDigest': guard.SOURCE, 'sourceRepositoryURI': 'https://github.com/' + guard.REPOSITORY, 'subjectAlternativeName': guard.WORKFLOW}
        frontend = attestation(cert, 'ghcr.io/openresilienceinitiative/oriso-frontend', expected)
        storybook = attestation(cert, 'ghcr.io/openresilienceinitiative/oriso-storybook', second)
        with patch.object(guard, 'run', side_effect=[expected, json.dumps([frontend]), second, json.dumps([storybook])]): guard.verify_images()
        with patch.object(guard, 'run', return_value='sha256:' + '0' * 64):
            with self.assertRaises(ValueError): guard.verify_images()
        cert['sourceRepositoryDigest'] = '0' * 40
        with patch.object(guard, 'run', side_effect=[expected, json.dumps([{'verificationResult': {'signature': {'certificate': cert}}}])]):
            with self.assertRaises(ValueError): guard.verify_images()

    def test_subject_name_and_digest_must_match_the_same_signed_item(self):
        digest = guard.IMAGES['oriso-frontend']
        name = 'ghcr.io/openresilienceinitiative/oriso-frontend'
        cert = {'sourceRepositoryDigest': guard.SOURCE, 'sourceRepositoryURI': 'https://github.com/' + guard.REPOSITORY, 'subjectAlternativeName': guard.WORKFLOW}
        wrong_cert = dict(cert, sourceRepositoryDigest='0' * 40)
        bad = {
            'wrong name': [attestation(cert, 'ghcr.io/unrelated/wrong-image', digest)],
            'missing subject': [{'verificationResult': {'signature': {'certificate': cert}, 'statement': {}}}],
            'wrong digest': [attestation(cert, name, 'sha256:' + '0' * 64)],
            'cross-item mixing': [attestation(cert, 'ghcr.io/unrelated/wrong-image', digest), attestation(wrong_cert, name, digest)],
        }
        second = guard.IMAGES['oriso-storybook']
        second_item = attestation(cert, 'ghcr.io/openresilienceinitiative/oriso-storybook', second)
        for label, items in bad.items():
            with self.subTest(label=label), patch.object(guard, 'run', side_effect=[digest, json.dumps(items), second, json.dumps([second_item])]):
                with self.assertRaises(ValueError): guard.verify_images()

    def test_missing_or_wrong_workflow_and_repository_provenance_fail(self):
        first = next(iter(guard.IMAGES.values()))
        valid = {'sourceRepositoryDigest': guard.SOURCE, 'sourceRepositoryURI': 'https://github.com/' + guard.REPOSITORY, 'subjectAlternativeName': guard.WORKFLOW}
        for mutation in ('empty', 'workflow', 'repository'):
            cert = dict(valid)
            if mutation == 'workflow': cert['subjectAlternativeName'] = 'wrong-workflow'
            if mutation == 'repository': cert['sourceRepositoryURI'] = 'https://github.com/other/repo'
            result = [] if mutation == 'empty' else [{'verificationResult': {'signature': {'certificate': cert}}}]
            with self.subTest(mutation=mutation), patch.object(guard, 'run', side_effect=[first, json.dumps(result)]):
                with self.assertRaises(ValueError): guard.verify_images()

    def test_summary_outputs_distinguish_original_and_maintenance_candidate(self):
        head = '1' * 40
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'output'
            env = {'GITHUB_SHA': head, 'GITHUB_REF_NAME': 'release/frontend-2.0.15', 'GITHUB_OUTPUT': str(output)}
            remote = f'{head}\trefs/heads/release/frontend-2.0.15'
            with patch.dict(os.environ, env), patch.object(guard.sys, 'argv', ['guard.py', 'classify', '2.0.15']), patch.object(guard, 'run', side_effect=[head, remote, remote]), patch.object(guard, 'classify', return_value='verify_existing'):
                guard.main()
            data = output.read_text()
            self.assertIn('mode=verify_existing', data)
            self.assertIn(f'source={guard.SOURCE}', data)
            self.assertIn(f'frontend_digest={guard.IMAGES["oriso-frontend"]}', data)
            self.assertIn(f'storybook_digest={guard.IMAGES["oriso-storybook"]}', data)

    def test_stale_remote_branch_cannot_classify(self):
        head = '1' * 40
        with patch.dict(os.environ, {'GITHUB_SHA': head, 'GITHUB_REF_NAME': 'release/frontend-2.0.15'}), patch.object(guard.sys, 'argv', ['guard.py', 'classify', '2.0.15']), patch.object(guard, 'run', side_effect=[head, f'{"2" * 40}\trefs/heads/release/frontend-2.0.15']), patch.object(guard, 'classify') as classify:
            with self.assertRaises(ValueError): guard.main()
            classify.assert_not_called()

    def test_workflow_conditions_cover_every_mutating_step(self):
        workflow = (HERE.parent.parent / 'workflows/release-image.yml').read_text()
        names = ['Run frontend validation and build','Build Storybook static output','Set up QEMU','Login to GitHub Container Registry','Set up Docker Buildx','Build amd64 frontend image locally for scanning','Build amd64 Storybook image locally for scanning','Reject fixable frontend image vulnerabilities','Reject fixable Storybook image vulnerabilities','Verify tag still absent before publishing','Publish versioned frontend Docker image','Publish versioned Storybook Docker image','Sign and publish frontend image provenance','Sign and publish Storybook image provenance','Verify tag still absent before tagging','Create and push release tag','Create GitHub Release','Release summary']
        for name in names:
            match = re.search(r'^            - name: ' + re.escape(name) + r'\n(?P<body>.*?)(?=^            - name: |\Z)', workflow, re.MULTILINE | re.DOTALL)
            self.assertIsNotNone(match, name)
            self.assertIn("steps.disposition.outputs.mode == 'publish'", match.group('body'), name)
        self.assertIn('- name: Summarize verified existing release', workflow)
        self.assertIn("steps.disposition.outputs.mode == 'verify_existing'", workflow)
        self.assertIn('Publishing skipped — existing immutable artifacts verified', workflow)
        self.assertIn('steps.disposition.outputs.source', workflow)
        self.assertIn('steps.disposition.outputs.frontend_digest', workflow)
        self.assertIn('steps.disposition.outputs.storybook_digest', workflow)
        self.assertLess(workflow.index('- name: Verify tag still absent before publishing'), workflow.index('- name: Publish versioned frontend Docker image'))
        self.assertLess(workflow.index('- name: Verify tag still absent before tagging'), workflow.index('- name: Create and push release tag'))

if __name__ == '__main__': unittest.main()
