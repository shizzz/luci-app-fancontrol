#!/bin/sh
# Map an openwrt-fancontrol release asset suffix to an OpenWrt SDK ARCH value
# suitable for openwrt/gh-action-sdk.
#
# Usage: sdk-arch-for-asset.sh <asset_suffix>
# Example: sdk-arch-for-asset.sh arm64

set -e

SUFFIX="$(printf '%s' "$1" | tr 'A-Z' 'a-z')"

if [ -z "$SUFFIX" ]; then
	echo "Usage: $0 <asset_suffix>" >&2
	exit 1
fi

case "$SUFFIX" in
	amd64) printf '%s\n' "x86_64" ;;
	arm64) printf '%s\n' "aarch64_cortex-a53" ;;
	armv7) printf '%s\n' "arm_cortex-a9" ;;
	mipsel) printf '%s\n' "mipsel_24kc" ;;
	mips64el) printf '%s\n' "mips64el_mips64r2" ;;
	*)
		# Fall back to the suffix itself; gh-action-sdk may accept it.
		printf '%s\n' "$SUFFIX"
		;;
esac
