#!/usr/bin/env bash
set -euo pipefail

archive=${1:?OCI archive is required}
expected_digest=${2:?Expected OCI index digest is required}
expected_archive_sha256=${3:?Scanned archive SHA-256 is required}
: "${IMAGE_TAGS:?Image tags are required}"
: "${GITHUB_OUTPUT:?GitHub output file is required}"

archive_checksum=$(sha256sum "$archive")
if [[ "${archive_checksum%% *}" != "$expected_archive_sha256" ]]; then
  echo "The archive to publish differs from the scanned archive." >&2
  exit 1
fi

digest_file=$(mktemp "${TMPDIR:-/tmp}/oriso-image-digest.XXXXXX")
trap 'rm -f "$digest_file"' EXIT
copied=false
while IFS= read -r tag; do
  [[ -n "$tag" ]] || continue
  skopeo copy --all --preserve-digests \
    --authfile "${DOCKER_CONFIG:-$HOME/.docker}/config.json" \
    --digestfile "$digest_file" "oci-archive:$archive" "docker://$tag"
  if [[ "$(cat "$digest_file")" != "$expected_digest" ]]; then
    echo "Published image digest does not match the scanned build." >&2
    exit 1
  fi
  copied=true
done <<< "$IMAGE_TAGS"
if [[ "$copied" != true ]]; then
  echo "At least one nonempty image tag is required." >&2
  exit 2
fi
printf 'digest=%s\n' "$expected_digest" >> "$GITHUB_OUTPUT"
