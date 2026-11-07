import json
import subprocess
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch
import verify


def responses(*, tag=None, head=None, paths=None, digest=None, provenance=None):
    def execute(*cmd):
        if cmd[:2] == ('git', 'rev-parse'):
            return (tag or verify.SOURCE) if 'tags/' in cmd[2] else (head or verify.RELEASE_HEAD)
        if cmd[:2] == ('git', 'merge-base'):
            return ''
        if cmd[:2] == ('git', 'diff'):
            return paths if paths is not None else '.github/workflows/pr-base-check.yml'
        if cmd[0] == 'docker':
            name = 'oriso-storybook' if 'storybook' in cmd[4] else 'oriso-frontend'
            return digest or verify.IMAGES[name]
        cert = {'sourceRepositoryDigest': verify.SOURCE, 'sourceRepositoryURI': 'https://github.com/' + verify.REPOSITORY, 'subjectAlternativeName': verify.WORKFLOW}
        image = cmd[3].removeprefix('oci://').split('@')[0]
        expected = verify.IMAGES[image.rsplit('/', 1)[1]].removeprefix('sha256:')
        return json.dumps(provenance if provenance is not None else [{'verificationResult': {'signature': {'certificate': cert}, 'statement': {'subject': [{'name': image, 'digest': {'sha256': expected}}]}}}])
    return execute


class ReleaseVerificationTest(unittest.TestCase):
    def test_exact_known_release_passes(self):
        with patch.object(verify, 'run', side_effect=responses()):
            verify.verify()

    def test_subject_and_certificate_must_match_in_same_verified_item(self):
        image = 'ghcr.io/openresilienceinitiative/oriso-frontend'
        digest = verify.IMAGES['oriso-frontend']
        cert = {'sourceRepositoryDigest': verify.SOURCE, 'sourceRepositoryURI': 'https://github.com/' + verify.REPOSITORY, 'subjectAlternativeName': verify.WORKFLOW}
        def item(subject, certificate=cert):
            return {'verificationResult': {'signature': {'certificate': certificate}, 'statement': {'subject': subject}}}
        good = {'name': image, 'digest': {'sha256': digest.removeprefix('sha256:')}}
        self.assertTrue(verify.matches_provenance(item([good]), image, digest))
        for subject in ([{'name': image + '-other', 'digest': good['digest']}],
                        [{'name': image, 'digest': {}}],
                        [{'name': image, 'digest': {'sha256': 'bad'}}], []):
            with self.subTest(subject=subject):
                self.assertFalse(verify.matches_provenance(item(subject), image, digest))
        split = [item([good], {}), item([], cert)]
        self.assertFalse(any(verify.matches_provenance(entry, image, digest) for entry in split))

    def test_historical_sha_survives_deleted_branch_and_advanced_pr_head(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            def git(*args, cwd=root):
                return subprocess.check_output(('git', *args), cwd=cwd, text=True, stderr=subprocess.DEVNULL).strip()
            git('init', '--bare', 'remote.git')
            git('init', 'source')
            source = root / 'source'
            git('config', 'user.email', 'test@example.invalid', cwd=source)
            git('config', 'user.name', 'Test', cwd=source)
            (source / 'file').write_text('reviewed')
            git('add', 'file', cwd=source)
            git('commit', '-m', 'reviewed', cwd=source)
            reviewed = git('rev-parse', 'HEAD', cwd=source)
            git('push', str(root / 'remote.git'), 'HEAD:refs/heads/release/frontend-2.0.15', 'HEAD:refs/pull/2064/head', cwd=source)
            git('push', str(root / 'remote.git'), ':refs/heads/release/frontend-2.0.15', cwd=source)
            git('init', 'reader')
            reader = root / 'reader'
            git('fetch', str(root / 'remote.git'), f'{reviewed}:refs/release-proof/audited-2064', cwd=reader)
            self.assertEqual(git('rev-parse', 'refs/release-proof/audited-2064^{commit}', cwd=reader), reviewed)
            (source / 'file').write_text('unreviewed')
            git('commit', '-am', 'changed', cwd=source)
            git('push', str(root / 'remote.git'), 'HEAD:refs/pull/2064/head', cwd=source)
            git('fetch', str(root / 'remote.git'), f'{reviewed}:refs/release-proof/audited-2064', cwd=reader)
            self.assertEqual(git('rev-parse', 'refs/release-proof/audited-2064^{commit}', cwd=reader), reviewed)
            self.assertNotEqual(git('rev-parse', 'refs/pull/2064/head', cwd=root / 'remote.git'), reviewed)

    def test_rejects_wrong_tag_head_product_change_digest_and_provenance(self):
        cases = [dict(tag='bad'), dict(head='bad'), dict(paths='src/app.tsx'), dict(paths=''), dict(digest='sha256:bad'), dict(provenance=[]), dict(provenance=[{'verificationResult': {'signature': {'certificate': {}}}}])]
        for case in cases:
            with self.subTest(case=case), patch.object(verify, 'run', side_effect=responses(**case)), self.assertRaises(ValueError):
                verify.verify()


if __name__ == '__main__':
    unittest.main()
