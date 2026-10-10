#!/usr/bin/env bash
# Provision a Claude Code cloud environment (Ubuntu 24.04, root).
# The environment's setup script calls this once per cached snapshot; see
# WORKSPACE.md. Workspace dependencies are installed per session by
# scripts/cloud/session-start.sh.
set -euo pipefail

# Keep in step with .nvmrc, the root corepack dependency and CI's OpenSCAD package.
NODE_VERSION=24.15.0
COREPACK_VERSION=0.35.0
OPENSCAD_PACKAGE=2021.01-6build4
NODE_ROOT=/opt/node24

if [ "$(id -u)" -ne 0 ]; then
    echo "scripts/cloud/setup.sh must run as root, as the cloud setup script does." >&2
    exit 1
fi

case "$(uname -m)" in
    x86_64) node_arch=x64 ;;
    aarch64) node_arch=arm64 ;;
    *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

# The base image ships Node 20-22 only. Install the pinned release, checksum-verified.
if [ "$("$NODE_ROOT/bin/node" --version 2>/dev/null || true)" != "v$NODE_VERSION" ]; then
    dist="node-v$NODE_VERSION-linux-$node_arch"
    tmp="$(mktemp -d)"
    trap 'rm -rf "$tmp"' EXIT
    curl -fsSLo "$tmp/$dist.tar.xz" "https://nodejs.org/dist/v$NODE_VERSION/$dist.tar.xz"
    curl -fsSLo "$tmp/SHASUMS256.txt" "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt"
    (cd "$tmp" && grep " $dist.tar.xz\$" SHASUMS256.txt | sha256sum --check --quiet -)
    rm -rf "$NODE_ROOT"
    mkdir -p "$NODE_ROOT"
    tar -xJf "$tmp/$dist.tar.xz" -C "$NODE_ROOT" --strip-components=1
fi
export PATH="$NODE_ROOT/bin:$PATH"

# corepack resolves pnpm from the root packageManager field on first use.
npm install --global --no-audit --no-fund "corepack@$COREPACK_VERSION"
corepack enable pnpm
corepack enable --install-directory /usr/local/bin pnpm
for bin in node npm npx corepack; do
    ln -sf "$NODE_ROOT/bin/$bin" "/usr/local/bin/$bin"
done

# Same package CI installs for `pnpm cad:check -- --require-openscad`.
if [ "$(dpkg-query --show --showformat='${Version}' openscad 2>/dev/null || true)" != "$OPENSCAD_PACKAGE" ]; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install --yes "openscad=$OPENSCAD_PACKAGE"
fi

echo "node $(node --version), corepack $(corepack --version), $(openscad --version 2>&1)"
