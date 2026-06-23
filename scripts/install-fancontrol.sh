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

fetch() {
	if command -v curl >/dev/null 2>&1; then
		curl -fsSL "$1"
	elif command -v wget >/dev/null 2>&1; then
		wget -qO- "$1"
	else
		echo "Install curl or wget first." >&2
		exit 1
	fi
}

download() {
	url="$1"
	dest="$2"
	if command -v curl >/dev/null 2>&1; then
		curl -fsSL -o "$dest" "$url"
	elif command -v wget >/dev/null 2>&1; then
		wget -qO "$dest" "$url"
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

release_json() {
	json=""
	url=""

	for tag in latest continuous; do
		case "$tag" in
			latest)
				url="https://api.github.com/repos/${REPO}/releases/latest"
				;;
			continuous)
				url="https://api.github.com/repos/${REPO}/releases/tags/continuous"
				;;
		esac

		json="$(fetch "$url" 2>/dev/null)" || continue
		if printf '%s' "$json" | grep -q 'fancontrol_.*_\('"${ARCH}"'\|all\)\.\('"${EXT}"'\)'; then
			printf '%s' "$json"
			return 0
		fi
	done

	echo "No installable release found for ${ARCH} (.${EXT})." >&2
	echo "Check https://github.com/${REPO}/releases" >&2
	exit 1
}

find_asset_url() {
	json="$1"
	asset_kind="$2"

	printf '%s' "$json" | awk -v kind="$asset_kind" -v arch="$ARCH" -v ext="$EXT" '
	{
		rest = $0
		while (match(rest, /"https[^"]+\.(ipk|apk)"/)) {
			url = substr(rest, RSTART + 1, RLENGTH - 2)
			rest = substr(rest, RSTART + RLENGTH)
			if (kind == "fancontrol" && index(url, "/fancontrol_") && index(url, arch) && substr(url, length(url) - length(ext) + 1) == ext) {
				print url
				exit
			}
			if (kind == "luci" && index(url, "luci-app-fancontrol_") && index(url, "_all." ext)) {
				print url
				exit
			}
		}
	}
	'
}

PKG_MGR="$(detect_pkg_mgr)"
ARCH="$(detect_arch)"

case "$PKG_MGR" in
	opkg) EXT=ipk ;;
	apk) EXT=apk ;;
esac

JSON="$(release_json)"
FAN_URL="$(find_asset_url "$JSON" fancontrol)"
LUCI_URL="$(find_asset_url "$JSON" luci)"

if [ -z "$FAN_URL" ] || [ -z "$LUCI_URL" ]; then
	echo "No ${EXT} packages for architecture '${ARCH}' in the latest release." >&2
	printf '%s' "$JSON" \
		| sed -n 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
		| grep -E '\.(ipk|apk)$' >&2 || true
	exit 1
fi

mkdir -p "$TMPDIR"
trap 'rm -rf "$TMPDIR"' EXIT INT HUP TERM

FAN_PKG="$TMPDIR/fancontrol.${EXT}"
LUCI_PKG="$TMPDIR/luci-app-fancontrol.${EXT}"

echo "Architecture: ${ARCH}"
echo "Package manager: ${PKG_MGR}"
echo "Downloading fancontrol..."
download "$FAN_URL" "$FAN_PKG"
echo "Downloading luci-app-fancontrol..."
download "$LUCI_URL" "$LUCI_PKG"

case "$PKG_MGR" in
	opkg)
		opkg install "$FAN_PKG" "$LUCI_PKG"
		;;
	apk)
		apk add --allow-untrusted "$FAN_PKG" "$LUCI_PKG"
		;;
esac

if [ -x /etc/init.d/fancontrol ]; then
	/etc/init.d/fancontrol enable
	/etc/init.d/fancontrol restart || /etc/init.d/fancontrol start
fi

echo "Installed. Open LuCI: Services -> Fan Control"
