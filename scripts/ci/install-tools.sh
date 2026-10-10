#!/usr/bin/env bash
# Install only reviewed, checksum-locked upstream Linux amd64 release binaries.
# Usage: bash scripts/ci/install-tools.sh [all | actionlint zizmor | gh,regctl]
set -Eeuo pipefail

if [[ "$(uname -s)" != "Linux" || "$(uname -m)" != "x86_64" ]]; then
  printf 'This installer supports Linux amd64 only.\n' >&2
  exit 1
fi

for prerequisite in node curl sha256sum tar install mktemp; do
  if ! command -v "$prerequisite" >/dev/null 2>&1; then
    printf 'Missing installer prerequisite: %s\n' "$prerequisite" >&2
    exit 1
  fi
done

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
lock_path="$script_dir/tools.lock.json"
tools_dir="${CI_TOOLS_DIR:-$script_dir/../../.ci/bin}"
mkdir -p -- "$tools_dir"
tools_dir="$(cd -- "$tools_dir" && pwd -P)"
staging_dir="$(mktemp -d)"
trap 'rm -rf -- "$staging_dir"' EXIT

# Node is already set up at the application's exact version by the workflow.
# Parse data without eval, and reject unsafe or mutable download coordinates.
tool_rows="$(node --input-type=module - "$lock_path" "$@" <<'NODE'
import { readFileSync } from 'node:fs';

const [lockPath, ...selections] = process.argv.slice(2);
let requested = selections.flatMap(value => value.split(','));
if (requested.includes('all')) {
  if (requested.length !== 1) throw new Error('Use all without other tool names');
  requested = [];
}
const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
if (lock.schemaVersion !== 1 || lock.platform !== 'linux-amd64' || !Array.isArray(lock.tools)) {
  throw new Error('Unsupported CI tool lock schema/platform');
}
const names = new Set();
for (const tool of lock.tools) {
  if (!/^[a-z][a-z0-9-]*$/.test(tool.name) || names.has(tool.name)) {
    throw new Error('Invalid or duplicate tool name');
  }
  names.add(tool.name);
  if (!/^\d+\.\d+\.\d+$/.test(tool.version) || tool.tag !== `v${tool.version}` ||
      !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(tool.repository) ||
      !/^[a-f0-9]{64}$/.test(tool.sha256) || !['tar.gz', 'binary'].includes(tool.format)) {
    throw new Error(`Invalid pin for ${tool.name}`);
  }
  const prefix = `https://github.com/${tool.repository}/releases/download/${tool.tag}/`;
  if (!tool.url.startsWith(prefix) || !/^[A-Za-z0-9_.-]+$/.test(tool.url.slice(prefix.length))) {
    throw new Error(`Unsafe release URL for ${tool.name}`);
  }
  if (tool.format === 'tar.gz' &&
      (!/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(tool.binaryPath) ||
       tool.binaryPath.split('/').some(part => part === '.' || part === '..'))) {
    throw new Error(`Unsafe archive member for ${tool.name}`);
  }
  if (tool.format === 'binary' && tool.binaryPath !== '') {
    throw new Error(`Unexpected archive member for ${tool.name}`);
  }
}
for (const name of requested) {
  if (!names.has(name)) throw new Error(`Tool is not locked: ${name}`);
}
for (const tool of lock.tools) {
  if (requested.length && !requested.includes(tool.name)) continue;
  // A sentinel keeps Bash's whitespace-based read from dropping an empty field.
  console.log([tool.name, tool.version, tool.url, tool.sha256, tool.format,
    tool.binaryPath || '-'].join('\t'));
}
NODE
)"

while IFS=$'\t' read -r name version url digest format binary_path; do
  archive="$staging_dir/$name.download"
  printf 'Installing %s %s\n' "$name" "$version"
  curl --proto '=https' --proto-redir '=https' --tlsv1.2 \
    --fail --silent --show-error --location --retry 3 \
    --connect-timeout 15 --max-time 300 --output "$archive" "$url"
  printf '%s  %s\n' "$digest" "$archive" | sha256sum --check --status

  if [[ "$format" == 'tar.gz' ]]; then
    # Extract just the named regular file; never an entire untrusted archive.
    member_listing="$(tar -tvzf "$archive" -- "$binary_path")"
    if [[ "${member_listing:0:1}" != '-' || "$member_listing" == *$'\n'* ]]; then
      printf 'Expected one regular archive member for %s\n' "$name" >&2
      exit 1
    fi
    extract_dir="$staging_dir/$name"
    mkdir -- "$extract_dir"
    tar -xzf "$archive" -C "$extract_dir" -- "$binary_path"
    install -m 0755 -- "$extract_dir/$binary_path" "$tools_dir/$name"
  else
    install -m 0755 -- "$archive" "$tools_dir/$name"
  fi
  if [[ "$name" == 'buildx' ]]; then
    docker_config="${DOCKER_CONFIG:-${HOME:?HOME or DOCKER_CONFIG must be set}/.docker}"
    mkdir -p -- "$docker_config/cli-plugins"
    install -m 0755 -- "$tools_dir/buildx" "$docker_config/cli-plugins/docker-buildx"
  fi
done <<< "$tool_rows"

if [[ -n "${GITHUB_PATH:-}" ]]; then
  printf '%s\n' "$tools_dir" >> "$GITHUB_PATH"
fi
if [[ -n "${GITHUB_ENV:-}" ]]; then
  printf 'CI_TOOLS_BIN=%s\n' "$tools_dir" >> "$GITHUB_ENV"
fi
printf 'Verified CI tools installed in %s\n' "$tools_dir"
printf 'For this shell: export PATH="%s:$PATH"\n' "$tools_dir"
