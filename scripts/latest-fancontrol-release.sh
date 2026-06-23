#!/bin/sh
# Print the latest openwrt-fancontrol release version (without leading "v").
#
# Usage: latest-fancontrol-release.sh [github_repo]
# Example: latest-fancontrol-release.sh shizzz/openwrt-fancontrol

set -e

REPO="${1:-shizzz/openwrt-fancontrol}"

if command -v curl >/dev/null 2>&1; then
	JSON="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest")"
elif command -v wget >/dev/null 2>&1; then
	JSON="$(wget -qO- "https://api.github.com/repos/${REPO}/releases/latest")"
else
	echo "Neither curl nor wget available" >&2
	exit 1
fi

printf '%s' "$JSON" \
	| sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
	| head -n1 \
	| sed 's/^v//'
