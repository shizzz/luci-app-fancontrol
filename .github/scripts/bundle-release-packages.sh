#!/bin/sh
# Bundle snapshot (.apk) and OpenWrt 24.10 (.ipk) artifacts per architecture.
#
# Usage: bundle-release-packages.sh <label> [<label> ...]
#
# Expects artifact directories:
#   dist/<label>-snapshot-packages/*
#   dist/<label>-openwrt-24.10-packages/*

set -e

DIST="${DIST:-dist}"
OUT="${OUT:-dist/bundles}"

if [ "$#" -eq 0 ]; then
	echo "Usage: $0 <label> [<label> ...]" >&2
	exit 1
fi

mkdir -p "$OUT"

for label in "$@"; do
	bundle_dir="${OUT}/${label}"
	rm -rf "$bundle_dir"
	mkdir -p "$bundle_dir"

	for variant in snapshot openwrt-24.10; do
		artifact_dir="${DIST}/${label}-${variant}-packages"
		if [ ! -d "$artifact_dir" ]; then
			echo "Missing artifact directory: ${artifact_dir}" >&2
			exit 1
		fi
		find "$artifact_dir" -type f \( -name '*.ipk' -o -name '*.apk' \) -exec cp {} "$bundle_dir/" \;
	done

	for pkg in fancontrol luci-app-fancontrol; do
		if ! find "$bundle_dir" -maxdepth 1 -name "${pkg}*.apk" -print -quit | grep -q .; then
			echo "Missing ${pkg} .apk in bundle ${label}" >&2
			exit 1
		fi
		if ! find "$bundle_dir" -maxdepth 1 -name "${pkg}*.ipk" -print -quit | grep -q .; then
			echo "Missing ${pkg} .ipk in bundle ${label}" >&2
			exit 1
		fi
	done

	archive="${OUT}/fancontrol-${label}-packages.tar.gz"
	tar czf "$archive" -C "$bundle_dir" .
	echo "Created ${archive}:"
	tar tzf "$archive"
done
