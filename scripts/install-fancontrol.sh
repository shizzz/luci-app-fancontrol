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

# Map OpenWrt DISTRIB_ARCH to tagged-release bundle labels (arm64, amd64, ...).
release_label_for_arch() {
	case "$1" in
		x86_64) printf '%s\n' "amd64" ;;
		aarch64_cortex-a53|aarch64_*) printf '%s\n' "arm64" ;;
		arm_cortex-a9|arm_*) printf '%s\n' "armv7" ;;
		mipsel_24kc|mipsel_*) printf '%s\n' "mipsel" ;;
		mips64el_mips64r2|mips64el_*) printf '%s\n' "mips64el" ;;
		*) printf '%s\n' "$1" ;;
	esac
}

release_usable() {
	json="$1"
	label="$(release_label_for_arch "$ARCH")"

	if printf '%s' "$json" | grep -qE "fancontrol_[^\"]+_${ARCH}\\.ipk"; then
		return 0
	fi
	if [ "$EXT" = "apk" ] && printf '%s' "$json" | grep -qE 'fancontrol-[^"]+\.apk'; then
		return 0
	fi
	if printf '%s' "$json" | grep -qE "fancontrol-${ARCH}-packages\\.tar\\.gz"; then
		return 0
	fi
	if printf '%s' "$json" | grep -qE "fancontrol-${label}-packages\\.tar\\.gz"; then
		return 0
	fi
	return 1
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
		if release_usable "$json"; then
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

	case "$asset_kind" in
		fancontrol)
			if [ "$EXT" = "apk" ]; then
				printf '%s' "$json" \
					| grep -oE '"https://[^"]+/fancontrol-[^"]+\.apk"' \
					| head -n1 \
					| tr -d '"'
				return 0
			fi
			printf '%s' "$json" \
				| grep -oE "\"https://[^\"]+/fancontrol_[^\"]+_${ARCH}\\.ipk\"" \
				| head -n1 \
				| tr -d '"'
			;;
		luci)
			if [ "$EXT" = "apk" ]; then
				printf '%s' "$json" \
					| grep -oE '"https://[^"]+/luci-app-fancontrol-[^"]+\.apk"' \
					| head -n1 \
					| tr -d '"'
				return 0
			fi
			printf '%s' "$json" \
				| grep -oE '"https://[^"]+/luci-app-fancontrol_[^"]+_all\.ipk"' \
				| head -n1 \
				| tr -d '"'
			;;
	esac
}

find_bundle_url() {
	json="$1"
	label="$(release_label_for_arch "$ARCH")"

	for name in "fancontrol-${ARCH}-packages.tar.gz" "fancontrol-${label}-packages.tar.gz"; do
		url="$(printf '%s' "$json" \
			| grep -oE "\"https://[^\"]+/${name}\"" \
			| head -n1 \
			| tr -d '"')"
		if [ -n "$url" ]; then
			printf '%s\n' "$url"
			return 0
		fi
	done

	return 1
}

find_packages_in_dir() {
	dir="$1"

	if [ "$EXT" = "apk" ]; then
		FAN_PKG="$(find "$dir" -maxdepth 1 -name 'fancontrol-*.apk' | head -n1)"
		LUCI_PKG="$(find "$dir" -maxdepth 1 -name 'luci-app-fancontrol-*.apk' | head -n1)"
	else
		FAN_PKG="$(find "$dir" -maxdepth 1 -name "fancontrol_*_${ARCH}.ipk" | head -n1)"
		LUCI_PKG="$(find "$dir" -maxdepth 1 -name 'luci-app-fancontrol_*_all.ipk' | head -n1)"
	fi

	if [ -z "$FAN_PKG" ] || [ -z "$LUCI_PKG" ]; then
		return 1
	fi
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

JSON="$(release_json)"
FAN_URL="$(find_asset_url "$JSON" fancontrol)"
LUCI_URL="$(find_asset_url "$JSON" luci)"

mkdir -p "$TMPDIR"
trap 'rm -rf "$TMPDIR"' EXIT INT HUP TERM

echo "Architecture: ${ARCH}"
echo "Package manager: ${PKG_MGR}"

if [ -n "$FAN_URL" ] && [ -n "$LUCI_URL" ]; then
	FAN_PKG="$TMPDIR/fancontrol.${EXT}"
	LUCI_PKG="$TMPDIR/luci-app-fancontrol.${EXT}"

	echo "Downloading fancontrol..."
	download "$FAN_URL" "$FAN_PKG"
	echo "Downloading luci-app-fancontrol..."
	download "$LUCI_URL" "$LUCI_PKG"
	install_packages "$FAN_PKG" "$LUCI_PKG"
else
	BUNDLE_URL="$(find_bundle_url "$JSON")"
	if [ -z "$BUNDLE_URL" ]; then
		echo "No ${EXT} packages for architecture '${ARCH}' in the selected release." >&2
		printf '%s' "$JSON" \
			| sed -n 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
			| grep -E '\.(ipk|apk|tar\.gz)$' >&2 || true
		exit 1
	fi

	BUNDLE="$TMPDIR/bundle.tar.gz"
	EXTRACT_DIR="$TMPDIR/bundle"

	echo "Downloading package bundle..."
	download "$BUNDLE_URL" "$BUNDLE"
	mkdir -p "$EXTRACT_DIR"
	tar -xzf "$BUNDLE" -C "$EXTRACT_DIR"

	if ! find_packages_in_dir "$EXTRACT_DIR"; then
		echo "Bundle did not contain fancontrol + luci-app-fancontrol (.${EXT}) for ${ARCH}." >&2
		ls -la "$EXTRACT_DIR" >&2 || true
		exit 1
	fi

	install_packages "$FAN_PKG" "$LUCI_PKG"
fi

if [ -x /etc/init.d/fancontrol ]; then
	/etc/init.d/fancontrol enable
	/etc/init.d/fancontrol restart || /etc/init.d/fancontrol start
fi

echo "Installed. Open LuCI: Services -> Fan Control"
