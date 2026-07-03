#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
: "${PYTHON:=python3}"

echo "Starting AirMemory demo..."
echo ""
echo "1. Reset demo"
./scripts/reset_demo.sh

echo ""
echo "2. Seed historical memory"
"$PYTHON" scripts/seed_memory.py

echo ""
echo "3. Emit demo failure"
"$PYTHON" scripts/emit_demo_failure.py

echo ""
echo "4. Process one failure event"
"$PYTHON" scripts/run_worker.py --once

echo ""
echo "5. Demo processed"
echo ""
echo "Open dashboard:"
echo "streamlit run airmemory/dashboard/app.py"
echo ""
echo "Open wiki:"
echo "wiki/index.md"
