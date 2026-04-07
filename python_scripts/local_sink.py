#!/usr/bin/env python3
"""
Local Data Sink Server
======================
Run this on the experiment machine BEFORE starting participants.
It listens on localhost:5001 and immediately writes every piece of
experiment data to disk as it arrives from the browser.

Firebase is still the primary destination; this acts as a safety net.

Usage:
    cd python_scripts/
    python local_sink.py

Data is saved to:
    ../local_data/
    ├── subjects.ndjson      ← one JSON record per line, appended
    ├── trials.ndjson        ← one JSON record per line, appended
    ├── audio/<subject_id>/  ← .webm audio files
    └── transcripts/<subject_id>/  ← .csv transcript files
"""

import os
import json
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

# ── Configuration ──────────────────────────────────────────────────────────────

PORT = 5001
DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'local_data')

# ── Setup ───────────────────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app)   # allow the browser (any localhost origin) to POST here

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(os.path.join(DATA_DIR, 'audio'), exist_ok=True)
os.makedirs(os.path.join(DATA_DIR, 'transcripts'), exist_ok=True)

# ── Helpers ─────────────────────────────────────────────────────────────────────

def append_ndjson(path, record):
    """Append a single dict as one line of newline-delimited JSON."""
    record['_local_saved_at'] = datetime.now().isoformat()
    with open(path, 'a', encoding='utf-8') as f:
        f.write(json.dumps(record) + '\n')
    print(f"[sink] wrote {path}")

# ── Routes ───────────────────────────────────────────────────────────────────────

@app.route('/subject', methods=['POST'])
def save_subject():
    """Receive subject demographics and save to subjects.ndjson."""
    data = request.get_json(force=True)
    if not data:
        return jsonify({'error': 'no JSON body'}), 400
    append_ndjson(os.path.join(DATA_DIR, 'subjects.ndjson'), data)
    return jsonify({'status': 'ok'})


@app.route('/trial', methods=['POST'])
def save_trial():
    """Receive trial result and save to trials.ndjson."""
    data = request.get_json(force=True)
    if not data:
        return jsonify({'error': 'no JSON body'}), 400
    append_ndjson(os.path.join(DATA_DIR, 'trials.ndjson'), data)
    return jsonify({'status': 'ok'})


@app.route('/file', methods=['POST'])
def save_file():
    """
    Receive an audio (.webm) or transcript (.csv) file.
    Form fields:  file, filename, subject_id, file_type ('audio' | 'transcript')
    """
    uploaded = request.files.get('file')
    if not uploaded:
        return jsonify({'error': 'no file in request'}), 400

    subject_id = request.form.get('subject_id', 'unknown')
    filename   = request.form.get('filename', uploaded.filename or 'unknown')
    file_type  = request.form.get('file_type', 'unknown')

    subdir = 'audio' if file_type == 'audio' else 'transcripts'
    save_dir = os.path.join(DATA_DIR, subdir, subject_id)
    os.makedirs(save_dir, exist_ok=True)

    dest = os.path.join(save_dir, filename)
    uploaded.save(dest)
    print(f"[sink] saved {file_type}: {dest}")
    return jsonify({'status': 'ok', 'path': dest})


@app.route('/ping', methods=['GET'])
def ping():
    """Health-check endpoint — the browser probes this on startup."""
    return jsonify({'status': 'running', 'port': PORT})


# ── Entry point ──────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    print("=" * 60)
    print(f"  Local data sink running on http://localhost:{PORT}")
    print(f"  Saving data to: {os.path.abspath(DATA_DIR)}")
    print("  Press Ctrl+C to stop.")
    print("=" * 60)
    app.run(host='127.0.0.1', port=PORT, debug=False)
