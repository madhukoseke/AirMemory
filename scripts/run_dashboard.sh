#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
streamlit run airmemory/dashboard/app.py
