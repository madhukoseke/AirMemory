#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
: "${PYTHON:=python3}"
"$PYTHON" scripts/reset_demo.py
