#!/bin/bash
# start_sink.sh
# Run this before starting participants to enable local disk backup.
# Leave this terminal open the whole session. Press Ctrl+C to stop.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "============================================================"
echo "  Activating Python environment..."
echo "============================================================"
source "$SCRIPT_DIR/venv/bin/activate"

echo ""
echo "============================================================"
echo "  Starting local data sink on http://localhost:5001"
echo "  Data will be saved to: $SCRIPT_DIR/local_data/"
echo "  Press Ctrl+C to stop."
echo "============================================================"
echo ""

python "$SCRIPT_DIR/python_scripts/local_sink.py"
