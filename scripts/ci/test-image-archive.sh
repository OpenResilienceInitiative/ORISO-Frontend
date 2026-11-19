#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

require_line() {
  grep -Fq -- "$2" "$1" || fail "$1 must contain $2"
}

line_number() {
  grep -nF -- "$2" "$1" | cut -d: -f1
}

action=.github/actions/docker-build-push/action.yml
workflows=.github/workflows
release="$workflows/release-image.yml"
[[ "$(grep -Fc 'docker/build-push-action' "$action")" == 1 ]] || fail 'The shared action must build once'
for workflow in ci-main.yml ci-storybook-main.yml ci-pull-request.yml ci-storybook-pull-request.yml; do
  [[ "$(grep -Fc 'uses: ./.github/actions/docker-build-push' "$workflows/$workflow")" == 1 ]] ||
    fail "$workflow must build and scan exactly one archive"
done
for workflow in ci-main.yml ci-storybook-main.yml; do
  require_line "$workflows/$workflow" 'push_to_ghcr: true'
done
for workflow in ci-pull-request.yml ci-storybook-pull-request.yml; do
  require_line "$workflows/$workflow" 'push_to_ghcr: false'
  require_line "$workflows/$workflow" 'platforms: linux/amd64'
  if grep -Eq 'packages: write|github_token:|push_to_ghcr: true|actions/attest|docker/login-action' "$workflows/$workflow"; then
    fail "$workflow must not publish or supply registry credentials"
  fi
done
require_line "$action" 'push: false'
require_line "$action" 'outputs: type=oci,'
require_line "$action" 'provenance: mode=max'
require_line "$action" 'sbom: true'
require_line "$action" 'EXPECTED_ARCHIVE_SHA256: ${{ steps.scan.outputs.archive_sha256 }}'
for step in 'Login to GitHub Container Registry' 'Publish the scanned archive without rebuilding'; do
  grep -A 3 -F -- "- name: $step" "$action" |
    grep -Fq "inputs.push_to_ghcr == 'true'" || fail "$step must be skipped in PRs"
done
scan_line=$(line_number "$action" 'scan-image-archive.sh')
login_line=$(line_number "$action" 'docker/login-action')
publish_line=$(line_number "$action" 'publish-image-archive.sh')
((scan_line < login_line && login_line < publish_line)) || fail 'Both manifests must pass the scan before login and upload'

[[ "$(grep -Fc 'push_to_ghcr: false' "$release")" == 2 ]] || fail 'The release must stage both archives without publishing'
[[ "$(grep -Fc 'scripts/ci/publish-image-archive.sh' "$release")" == 2 ]] || fail 'Both release uploads must use the archive'
if grep -Eq 'push: true|push_to_ghcr: true|docker/build-push-action|load: true' "$release"; then
  fail 'Buildx or the archive staging step must not upload during release classification or preparation'
fi
app_archive=$(line_number "$release" 'id: frontend_archive')
storybook_archive=$(line_number "$release" 'id: storybook_archive')
release_login=$(line_number "$release" 'Login to GitHub Container Registry')
guard_publish=$(line_number "$release" 'Verify tag still absent before publishing')
app_publish=$(line_number "$release" 'id: frontend_image')
storybook_publish=$(line_number "$release" 'id: storybook_image')
guard_tag=$(line_number "$release" 'Verify tag still absent before tagging')
git_tag=$(line_number "$release" 'git tag -a')
((app_archive < storybook_archive && storybook_archive < release_login && release_login < guard_publish &&
  guard_publish < app_publish && app_publish < storybook_publish && storybook_publish < guard_tag && guard_tag < git_tag)) ||
  fail 'Both archives must pass before login, the tag guard and either release upload'
for image in frontend storybook; do
  require_line "$release" "steps.${image}_archive.outputs.archive_sha256"
  require_line "$release" "subject-digest: \${{ steps.${image}_image.outputs.digest }}"
done
require_line "$release" "steps.disposition.outputs.mode == 'verify_existing'"
printf '%s\n' 'Frontend branch, release and no-push PR workflow contracts passed.'

scratch=$(mktemp -d "${TMPDIR:-/tmp}/frontend-archive-test.XXXXXX")
trap 'rm -rf "$scratch"' EXIT
export TEST_INDEX="$scratch/index.json" TEST_SCANS="$scratch/scans" TEST_UPLOAD="$scratch/upload"
export GITHUB_OUTPUT="$scratch/receipt" IMAGE_TAGS=example.invalid/frontend:fixture
export TEST_FAIL_PLATFORM='' TEST_WRONG_ARCH='' TEST_WRONG_UPLOAD_DIGEST=''
archive="$scratch/image.tar"
platforms=linux/amd64,linux/arm64
printf '%s' 'synthetic archive' > "$archive"
cat > "$TEST_INDEX" <<'JSON'
{"manifests": [
  {
    "platform": {"os": "linux", "architecture": "amd64"},
    "digest": "sha256:0000000000000000000000000000000000000000000000000000000000000001"
  },
  {
    "platform": {"os": "linux", "architecture": "arm64"},
    "digest": "sha256:0000000000000000000000000000000000000000000000000000000000000002"
  }
]}
JSON
checksum=$(sha256sum "$TEST_INDEX")
export TEST_INDEX_DIGEST="sha256:${checksum%% *}"

cat > "$scratch/skopeo" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
case "$1" in
  inspect)
    [[ "$2" == --raw && "$3" == oci-archive:* ]]
    cat "$TEST_INDEX"
    ;;
  manifest-digest)
    checksum=$(sha256sum "$2")
    printf 'sha256:%s\n' "${checksum%% *}"
    ;;
  --override-os)
    [[ "$2" == linux && "$3" == --override-arch && "$5" == copy &&
       "$6" == --preserve-digests && "$7" == --digestfile ]]
    case "$4" in amd64) number=1 ;; arm64) number=2 ;; *) exit 2 ;; esac
    if [[ "$4" == "$TEST_WRONG_ARCH" ]]; then number=1; fi
    printf 'sha256:%064d\n' "$number" > "$8"
    ;;
  copy)
    [[ "$2" == --all && "$3" == --preserve-digests && "$4" == --authfile &&
       "$6" == --digestfile && "$8" == oci-archive:* && "$9" == docker://example.invalid/* ]]
    printf '%s\n' "$9" >> "$TEST_UPLOAD"
    printf '%s\n' "${TEST_WRONG_UPLOAD_DIGEST:-$TEST_INDEX_DIGEST}" > "$7"
    ;;
  *) exit 2 ;;
esac
SH
cat > "$scratch/trivy" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
[[ "$1" == image && "$2" == --input && "$4" == --platform &&
   "${*:6}" == '--format table --exit-code 1 --ignore-unfixed --vuln-type os,library --severity CRITICAL,HIGH' ]]
printf '%s\n' "$5" >> "$TEST_SCANS"
[[ "$5" != "$TEST_FAIL_PLATFORM" ]]
SH
chmod 700 "$scratch/skopeo" "$scratch/trivy"
export PATH="$scratch:$PATH"

scan() {
  bash scripts/ci/scan-image-archive.sh "$archive" "$platforms" "$TEST_INDEX_DIGEST"
}

publish() {
  bash scripts/ci/publish-image-archive.sh "$archive" "$TEST_INDEX_DIGEST" "$1"
}

scan
[[ "$(cat "$TEST_SCANS")" == $'linux/amd64\nlinux/arm64' ]] || fail 'Both platforms must be scanned'
[[ ! -e "$TEST_UPLOAD" ]] || fail 'The scan must not upload to a registry'
receipt=$(sed -n 's/^archive_sha256=//p' "$GITHUB_OUTPUT")
publish "$receipt"
require_line "$GITHUB_OUTPUT" "digest=$TEST_INDEX_DIGEST"
require_line "$TEST_UPLOAD" "docker://$IMAGE_TAGS"

rm "$GITHUB_OUTPUT" "$TEST_UPLOAD"
if TEST_FAIL_PLATFORM=linux/arm64 scan > "$scratch/scan.log"; then fail 'A failed platform must stop the scan'; fi
[[ ! -e "$GITHUB_OUTPUT" && ! -e "$TEST_UPLOAD" ]] || fail 'A failed scan must produce no publish receipt or upload'

rm "$TEST_SCANS"
if TEST_WRONG_ARCH=arm64 scan > "$scratch/scan.log" 2>&1; then fail 'A mismatched platform must be rejected'; fi
require_line "$scratch/scan.log" 'The selected linux/arm64 manifest differs from the OCI index.'
[[ "$(cat "$TEST_SCANS")" == linux/amd64 && ! -e "$GITHUB_OUTPUT" ]] ||
  fail 'A mismatched manifest must not reach Trivy or produce a publish receipt'

if TEST_WRONG_UPLOAD_DIGEST=sha256:wrong publish "$receipt" 2> "$scratch/publish.log"; then
  fail 'A different uploaded digest must be rejected'
fi
require_line "$scratch/publish.log" 'Published image digest does not match the scanned build.'
[[ ! -e "$GITHUB_OUTPUT" ]] || fail 'A wrong uploaded digest must produce no successful publication receipt'
rm "$TEST_UPLOAD"
printf '%s' 'changed archive' > "$archive"
if publish "$receipt" 2> "$scratch/publish.log"; then fail 'A modified archive must not be published'; fi
require_line "$scratch/publish.log" 'The archive to publish differs from the scanned archive.'
[[ ! -e "$GITHUB_OUTPUT" && ! -e "$TEST_UPLOAD" ]] || fail 'A changed archive must be rejected before upload'
printf '%s\n' 'OCI archive scan and publication failure contracts passed.'
