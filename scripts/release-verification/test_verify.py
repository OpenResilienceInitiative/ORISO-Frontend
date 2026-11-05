import json
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
        return json.dumps(provenance if provenance is not None else [{'verificationResult': {'signature': {'certificate': cert}}}])
    return execute


class ReleaseVerificationTest(unittest.TestCase):
    def test_exact_known_release_passes(self):
        with patch.object(verify, 'run', side_effect=responses()):
            verify.verify()

    def test_rejects_wrong_tag_head_product_change_digest_and_provenance(self):
        cases = [dict(tag='bad'), dict(head='bad'), dict(paths='src/app.tsx'), dict(paths=''), dict(digest='sha256:bad'), dict(provenance=[]), dict(provenance=[{'verificationResult': {'signature': {'certificate': {}}}}])]
        for case in cases:
            with self.subTest(case=case), patch.object(verify, 'run', side_effect=responses(**case)), self.assertRaises(ValueError):
                verify.verify()


if __name__ == '__main__':
    unittest.main()
