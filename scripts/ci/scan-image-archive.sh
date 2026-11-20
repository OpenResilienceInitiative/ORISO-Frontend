#!/usr/bin/env bash
set -euo pipefail

archive=${1:?OCI archive is required}
platforms=${2-}
expected_digest=${3:?Expected OCI index digest is required}
: "${GITHUB_OUTPUT:?GitHub output file is required}"
if [[ ! "$platforms" =~ ^linux/(amd64|arm64)(,linux/(amd64|arm64))*$ ]]; then
  echo "Expected a nonempty list of linux/amd64 or linux/arm64 platforms." >&2
  exit 2
fi

archive_checksum=$(sha256sum "$archive")
scan_root=$(mktemp -d "${TMPDIR:-/tmp}/oriso-image-scan.XXXXXX")
trap 'rm -rf "$scan_root"' EXIT
index="$scan_root/index.json"
skopeo inspect --raw "oci-archive:$archive" > "$index"
if [[ "$(skopeo manifest-digest "$index")" != "$expected_digest" ]]; then
  echo "The OCI index digest differs from the build output." >&2
  exit 1
fi

expected_platforms=$(printf '%s' "$platforms" | tr ',' '\n' | LC_ALL=C sort | paste -sd, -)
# BuildKit appends provenance and SBOM manifests with an unknown platform.
image_platforms=$(jq -er '
  [.manifests[] |
    select((.platform.os == "unknown" and .platform.architecture == "unknown" and
      .annotations["vnd.docker.reference.type"] == "attestation-manifest") | not) |
    "\(.platform.os)/\(.platform.architecture)"] | sort | join(",")
' "$index")
if [[ "$image_platforms" != "$expected_platforms" ]]; then
  echo "The OCI index does not contain the requested platform manifests." >&2
  exit 1
fi

IFS=',' read -ra targets <<< "$platforms"
for platform in "${targets[@]}"; do
  arch=${platform#linux/}
  expected_manifest=$(jq -er --arg arch "$arch" '
    [.manifests[] | select(.platform.os == "linux" and .platform.architecture == $arch)] |
    if length == 1 then .[0].digest else error("Expected exactly one manifest for " + $arch) end
  ' "$index")
  # Select the manifest first. Trivy's OCI reader may ignore --platform on an index.
  skopeo --override-os linux --override-arch "$arch" copy --preserve-digests \
    --digestfile "$scan_root/$arch.digest" "oci-archive:$archive" "oci:$scan_root/$arch"
  if [[ "$(cat "$scan_root/$arch.digest")" != "$expected_manifest" ]]; then
    echo "The selected $platform manifest differs from the OCI index." >&2
    exit 1
  fi
  printf 'Scanning %s manifest %s\n' "$platform" "$expected_manifest"
  trivy image --input "$scan_root/$arch" --platform "$platform" \
    --format table --exit-code 1 --ignore-unfixed \
    --vuln-type os,library --severity CRITICAL,HIGH
done

printf 'archive_sha256=%s\n' "${archive_checksum%% *}" >> "$GITHUB_OUTPUT"
