#!/bin/sh
# Download and install the latest fancontrol + luci-app-fancontrol packages.
#
# Usage (on the router):
#   wget -O /tmp/install-fancontrol.sh \
#     https://raw.githubusercontent.com/shizzz/luci-app-fancontrol/develop/scripts/install-fancontrol.sh
#   sh /tmp/install-fancontrol.sh
#
# Supports opkg (.ipk) and apk (.apk). For apk, packages are installed with
# --allow-untrusted because they are not signed by the official OpenWrt feed.

set -e

REPO="${FANCONTROL_REPO:-shizzz/luci-app-fancontrol}"
TMPDIR="${TMPDIR:-/tmp/fancontrol-install.$$}"
DOWNLOAD_TIMEOUT="${FANCONTROL_DOWNLOAD_TIMEOUT:-120}"

fetch() {
	if command -v curl >/dev/null 2>&1; then
		curl -fsSL --max-time "$DOWNLOAD_TIMEOUT" "$1"
	elif command -v wget >/dev/null 2>&1; then
		wget -qO- --timeout="$DOWNLOAD_TIMEOUT" "$1"
	else
		echo "Install curl or wget first." >&2
		exit 1
	fi
}

download() {
	url="$1"
	dest="$2"

	echo "  $url"
	if command -v curl >/dev/null 2>&1; then
		curl -fL --max-time "$DOWNLOAD_TIMEOUT" -o "$dest" "$url"
	elif command -v wget >/dev/null 2>&1; then
		wget -q --timeout="$DOWNLOAD_TIMEOUT" -O "$dest" "$url"
	else
		echo "Install curl or wget first." >&2
		exit 1
	fi
}

detect_pkg_mgr() {
	if command -v opkg >/dev/null 2>&1; then
		echo opkg
	elif command -v apk >/dev/null 2>&1; then
		echo apk
	else
		echo "Neither opkg nor apk found on this system." >&2
		exit 1
	fi
}

detect_arch() {
	if [ -r /etc/openwrt_release ]; then
		# shellcheck disable=SC1091
		. /etc/openwrt_release
		if [ -n "${DISTRIB_ARCH:-}" ]; then
			printf '%s\n' "$DISTRIB_ARCH"
			return 0
		fi
	fi

	if command -v opkg >/dev/null 2>&1; then
		opkg print-architecture 2>/dev/null | awk 'NR==2 { print $2; exit }'
		return 0
	fi

	echo "Unable to detect target architecture." >&2
	exit 1
}

release_tag() {
	printf '%s' "$1" \
		| sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
		| head -n1
}

release_asset_names() {
	printf '%s' "$1" \
		| sed 's/.*"assets":\[//; s/\],"body".*//' \
		| tr '{' '\n' \
		| sed -n 's/.*"name": "\([^"]*\)".*/\1/p' \
		| grep -E '\.(ipk|apk)$' || true
}

release_download_url() {
	tag="$1"
	asset_name="$2"
	printf '%s\n' "https://github.com/${REPO}/releases/download/${tag}/${asset_name}"
}

find_fan_package_name() {
	for name in "$@"; do
		case "$name" in
			fancontrol_*_"${ARCH}".ipk)
				[ "$EXT" = "ipk" ] || continue
				printf '%s\n' "$name"
				return 0
				;;
			fancontrol-*.apk)
				[ "$EXT" = "apk" ] || continue
				printf '%s\n' "$name"
				return 0
				;;
		esac
	done
	return 1
}

find_luci_package_name() {
	for name in "$@"; do
		case "$name" in
			luci-app-fancontrol_*_all.ipk)
				[ "$EXT" = "ipk" ] || continue
				printf '%s\n' "$name"
				return 0
				;;
			luci-app-fancontrol-*.apk)
				[ "$EXT" = "apk" ] || continue
				printf '%s\n' "$name"
				return 0
				;;
		esac
	done
	return 1
}

install_packages() {
	fan_pkg="$1"
	luci_pkg="$2"

	case "$PKG_MGR" in
		opkg)
			opkg install "$fan_pkg" "$luci_pkg"
			;;
		apk)
			apk add --allow-untrusted "$fan_pkg" "$luci_pkg"
			;;
	esac
}

PKG_MGR="$(detect_pkg_mgr)"
ARCH="$(detect_arch)"

case "$PKG_MGR" in
	opkg) EXT=ipk ;;
	apk) EXT=apk ;;
esac

JSON="$(fetch "https://api.github.com/repos/${REPO}/releases/latest")"
TAG="$(release_tag "$JSON")"
if [ -z "$TAG" ]; then
	echo "Unable to resolve latest release tag." >&2
	exit 1
fi

# shellcheck disable=SC2086
set -- $(release_asset_names "$JSON")

FAN_NAME="$(find_fan_package_name "$@")" || FAN_NAME=""
LUCI_NAME="$(find_luci_package_name "$@")" || LUCI_NAME=""

if [ -z "$FAN_NAME" ] || [ -z "$LUCI_NAME" ]; then
	echo "No ${EXT} packages for architecture '${ARCH}' in latest release ${TAG}." >&2
	echo "Check https://github.com/${REPO}/releases/latest" >&2
	if [ "$#" -gt 0 ]; then
		echo "Available package assets:" >&2
		for name in "$@"; do
			echo "  - $name" >&2
		done
	fi
	exit 1
fi

mkdir -p "$TMPDIR"
trap 'rm -rf "$TMPDIR"' EXIT INT HUP TERM

FAN_PKG="$TMPDIR/fancontrol.${EXT}"
LUCI_PKG="$TMPDIR/luci-app-fancontrol.${EXT}"

echo "Release: ${TAG}"
echo "Architecture: ${ARCH}"
echo "Package manager: ${PKG_MGR}"
echo "Downloading fancontrol package..."
download "$(release_download_url "$TAG" "$FAN_NAME")" "$FAN_PKG"
echo "Downloading luci-app-fancontrol package..."
download "$(release_download_url "$TAG" "$LUCI_NAME")" "$LUCI_PKG"
install_packages "$FAN_PKG" "$LUCI_PKG"

if [ -x /etc/init.d/fancontrol ]; then
	/etc/init.d/fancontrol enable
	/etc/init.d/fancontrol restart || /etc/init.d/fancontrol start
fi

echo "Installed. Open LuCI: Services -> Fan Control"
