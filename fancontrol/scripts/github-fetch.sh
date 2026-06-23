#!/bin/sh
# Shared HTTP helpers for GitHub API and release downloads.

github_curl() {
	url="$1"

	if [ -n "${GITHUB_TOKEN:-}" ]; then
		curl -fsSL \
			-H "Authorization: Bearer ${GITHUB_TOKEN}" \
			-H "Accept: application/vnd.github+json" \
			-H "X-GitHub-Api-Version: 2022-11-28" \
			"$url"
	else
		curl -fsSL "$url"
	fi
}

github_download() {
	url="$1"
	dest="$2"

	if [ -n "${GITHUB_TOKEN:-}" ]; then
		curl -fsSL \
			-H "Authorization: Bearer ${GITHUB_TOKEN}" \
			-H "Accept: application/octet-stream" \
			-o "$dest" \
			"$url"
	else
		curl -fsSL -o "$dest" "$url"
	fi
}
