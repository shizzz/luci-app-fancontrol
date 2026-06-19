#!/bin/sh
# Resolve the openwrt-fancontrol release asset architecture suffix for a given
# OpenWrt target ARCH and upstream release tag.
#
# Usage: select-fancontrol-arch.sh <openwrt_arch> <release_tag>
# Example: select-fancontrol-arch.sh aarch64_cortex-a53 v0.0.2

set -e

OWRT_ARCH="$1"
TAG="$2"

if [ -z "$OWRT_ARCH" ] || [ -z "$TAG" ]; then
	echo "Usage: $0 <openwrt_arch> <release_tag>" >&2
	exit 1
fi

case "$TAG" in
	v*) TAG="${TAG#v}" ;;
esac

API_URL="https://api.github.com/repos/shizzz/openwrt-fancontrol/releases/tags/v${TAG}"

if command -v curl >/dev/null 2>&1; then
	JSON="$(curl -fsSL "$API_URL")"
elif command -v wget >/dev/null 2>&1; then
	JSON="$(wget -qO- "$API_URL")"
else
	echo "Neither curl nor wget available" >&2
	exit 1
fi

# Extract asset suffixes from release filenames.
ASSETS="$(printf '%s' "$JSON" | sed -n 's/.*openwrt-fancontrol-linux-\([^"]*\)\.tar\.gz.*/\1/p' | sort -u)"

if [ -z "$ASSETS" ]; then
	echo "No openwrt-fancontrol release assets found for tag v${TAG}" >&2
	exit 1
fi

normalize() {
	printf '%s' "$1" | tr 'A-Z' 'a-z' | tr '_' '-'
}

OWRT_NORM="$(normalize "$OWRT_ARCH")"

# Prefer direct substring matches between OpenWrt ARCH and asset suffix.
for suffix in $ASSETS; do
	SUFFIX_NORM="$(normalize "$suffix")"
	case "$OWRT_NORM" in
		*"$SUFFIX_NORM"*) printf '%s\n' "$suffix"; exit 0 ;;
	esac
done

# Derive likely Go/linux release suffix from OpenWrt ARCH naming patterns.
CANDIDATES=""

case "$OWRT_NORM" in
	x86-64*|amd64*) CANDIDATES="amd64" ;;
	aarch64*|arm64*) CANDIDATES="arm64" ;;
	mips64*) CANDIDATES="mips64el" ;;
	mips*) CANDIDATES="mipsel" ;;
	arm*) CANDIDATES="armv7" ;;
esac

for candidate in $CANDIDATES; do
	for suffix in $ASSETS; do
		if [ "$(normalize "$suffix")" = "$(normalize "$candidate")" ]; then
			printf '%s\n' "$suffix"
			exit 0
		fi
	done
done

echo "Unable to match OpenWrt ARCH '${OWRT_ARCH}' to a fancontrol release asset" >&2
echo "Available assets: $(printf '%s' "$ASSETS" | tr '\n' ' ')" >&2
exit 1
