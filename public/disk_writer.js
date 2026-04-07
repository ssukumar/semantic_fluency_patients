/**
 * disk_writer.js
 * ==============
 * Uses the browser File System Access API (Chrome/Edge only) to write
 * experiment data directly to a folder on the local hard drive.
 *
 * HOW IT WORKS:
 *  1. On "Begin Experiment", Chrome shows a native "pick a folder" dialog.
 *  2. The participant (or experimenter) selects any folder — e.g. Desktop.
 *  3. From that point on every subject record, trial record, audio file, and
 *     transcript CSV is written there immediately, in parallel with Firebase.
 *
 * Falls back silently if:
 *  - The API is not supported (Firefox, Safari, older Chrome)
 *  - The user dismisses the folder picker
 */

var DiskWriter = (function () {
    'use strict';

    var _dirHandle  = null;   // FileSystemDirectoryHandle for the chosen folder
    var _supported  = ('showDirectoryPicker' in window);
    var _ready      = false;

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Return (creating if needed) a sub-directory handle. */
    async function _subDir(name) {
        return _dirHandle.getDirectoryHandle(name, { create: true });
    }

    /** Return (creating if needed) a sub-sub-directory handle. */
    async function _subSubDir(parent, name) {
        return parent.getDirectoryHandle(name, { create: true });
    }

    /**
     * Append a line to a text file inside _dirHandle.
     * If the file doesn't exist it is created; existing content is preserved.
     */
    async function _appendLine(filename, line) {
        const fh     = await _dirHandle.getFileHandle(filename, { create: true });
        const access = await fh.createWritable({ keepExistingData: true });
        // Seek to end
        const file   = await fh.getFile();
        await access.seek(file.size);
        await access.write(line + '\n');
        await access.close();
    }

    /**
     * Write a Blob to subdir/subject_id/filename (overwrites if exists).
     */
    async function _writeBlob(subdirName, subject_id, filename, blob) {
        const sub     = await _subDir(subdirName);
        const subjDir = await _subSubDir(sub, subject_id);
        const fh      = await subjDir.getFileHandle(filename, { create: true });
        const access  = await fh.createWritable();
        await access.write(blob);
        await access.close();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Show the native folder-picker dialog.
     * Must be called from a user gesture (button click).
     * Returns true if the user picked a folder, false if they cancelled.
     */
    async function pickFolder() {
        if (!_supported) {
            console.warn('[DiskWriter] File System Access API not supported in this browser.');
            return false;
        }
        try {
            _dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            _ready = true;
            console.log('[DiskWriter] Folder selected:', _dirHandle.name,
                        '— data will be written to disk immediately.');
            return true;
        } catch (err) {
            if (err.name === 'AbortError') {
                console.warn('[DiskWriter] Folder picker cancelled — disk backup disabled for this session.');
            } else {
                console.error('[DiskWriter] Folder picker error:', err);
            }
            _ready = false;
            return false;
        }
    }

    /** Save subject demographics as a line in subjects.ndjson */
    async function writeSubject(data) {
        if (!_ready) return;
        try {
            var record = Object.assign({}, data, { _disk_saved_at: new Date().toISOString() });
            await _appendLine('subjects.ndjson', JSON.stringify(record));
            console.log('[DiskWriter] subject written to disk');
        } catch (e) {
            console.warn('[DiskWriter] writeSubject failed:', e);
        }
    }

    /** Save a trial result as a line in trials.ndjson */
    async function writeTrial(data) {
        if (!_ready) return;
        try {
            var record = Object.assign({}, data, { _disk_saved_at: new Date().toISOString() });
            await _appendLine('trials.ndjson', JSON.stringify(record));
            console.log('[DiskWriter] trial written to disk');
        } catch (e) {
            console.warn('[DiskWriter] writeTrial failed:', e);
        }
    }

    /** Save an audio Blob to audio/<subject_id>/<filename> */
    async function writeAudio(blob, filename, subject_id) {
        if (!_ready) return;
        try {
            await _writeBlob('audio', subject_id, filename, blob);
            console.log('[DiskWriter] audio written to disk:', filename);
        } catch (e) {
            console.warn('[DiskWriter] writeAudio failed:', e);
        }
    }

    /** Save a CSV Blob to transcripts/<subject_id>/<filename> */
    async function writeTranscript(blob, filename, subject_id) {
        if (!_ready) return;
        try {
            await _writeBlob('transcripts', subject_id, filename, blob);
            console.log('[DiskWriter] transcript written to disk:', filename);
        } catch (e) {
            console.warn('[DiskWriter] writeTranscript failed:', e);
        }
    }

    return {
        isSupported : function () { return _supported; },
        isReady     : function () { return _ready; },
        pickFolder  : pickFolder,
        writeSubject: writeSubject,
        writeTrial  : writeTrial,
        writeAudio  : writeAudio,
        writeTranscript: writeTranscript
    };

}());
