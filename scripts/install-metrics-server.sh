#!/usr/bin/env bash
set -euo pipefail

# Pinned release. https://github.com/kubernetes-sigs/metrics-server/releases/tag/v0.9.0
METRICS_SERVER_VERSION="v0.9.0"
MANIFEST_URL="https://github.com/kubernetes-sigs/metrics-server/releases/download/${METRICS_SERVER_VERSION}/components.yaml"

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT
manifest="${workdir}/components.yaml"
curl -fsSL "$MANIFEST_URL" -o "$manifest"

# kind's kubelet certificate is self-signed, so metrics-server must skip that TLS check.
if ! grep -q -- '--kubelet-insecure-tls' "$manifest"; then
  awk '
    /^[[:space:]]*- args:[[:space:]]*$/ && !added {
      print
      print "        - --kubelet-insecure-tls"
      added = 1
      next
    }
    { print }
  ' "$manifest" > "${workdir}/patched.yaml"
  mv "${workdir}/patched.yaml" "$manifest"
fi

kubectl apply -f "$manifest"
kubectl -n kube-system rollout status deployment/metrics-server --timeout=120s
kubectl top nodes
