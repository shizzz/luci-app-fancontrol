#!/bin/sh
# Download upstream fancontrol release metadata into the feed tree so SDK
# builds can resolve versions without hitting the GitHub API from containers.
#
# Usage: prefetch-fancontrol-release.sh [github_repo]

set -e

REPO="${1:-shizzz/openwrt-fancontrol}"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
CACHE_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)/files/.upstream-release"

. "$SCRIPT_DIR/github-fetch.sh"

VERSION="$(sh "$SCRIPT_DIR/latest-fancontrol-release.sh" "$REPO")"
if [ -z "$VERSION" ]; then
	echo "Unable to determine latest ${REPO} release tag" >&2
	exit 1
fi

mkdir -p "$CACHE_DIR"
printf '%s' "$VERSION" > "$CACHE_DIR/version"

HASHES_URL="https://github.com/${REPO}/releases/download/v${VERSION}/hashes.mk"
github_download "$HASHES_URL" "$CACHE_DIR/hashes.mk.tmp"
mv "$CACHE_DIR/hashes.mk.tmp" "$CACHE_DIR/hashes.mk"

printf 'Cached openwrt-fancontrol v%s in %s\n' "$VERSION" "$CACHE_DIR"
