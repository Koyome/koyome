#!/bin/sh
# ============================================
#  Koyome.me - one-click site update push (macOS / Linux)
#  Usage: sh push-update.sh        (or chmod +x, then ./push-update.sh)
#  On macOS, copy/rename to push-update.command to double-click in Finder.
#  All logic lives in tools/push-update.js (cross-platform).
# ============================================
cd "$(dirname "$0")" || exit 1

NODE=""
if command -v node >/dev/null 2>&1; then
  NODE="node"
elif command -v nodejs >/dev/null 2>&1; then
  NODE="nodejs"
fi

if [ -z "$NODE" ]; then
  echo "[ERROR] Node.js not found. Please install Node.js first."
  printf '%s' "Press Enter to close..."
  read -r _
  exit 1
fi

if "$NODE" tools/push-update.js "$@"; then
  echo
  echo "--------------------------------------------"
  echo " SUCCESS - you can close this window."
  echo "--------------------------------------------"
else
  echo
  echo "--------------------------------------------"
  echo " FAILED - read the reason and advice above."
  echo " This window stays open for review."
  echo "--------------------------------------------"
  printf '%s' "Press Enter to close..."
  read -r _
fi
