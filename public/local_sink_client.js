/**
 * local_sink_client.js
 * --------------------
 * Sends experiment data to the local Python sink server (localhost:5001)
 * immediately — before (and regardless of) the Firebase upload.
 *
 * If the sink is not running the calls fail silently so the experiment
 * is never interrupted.
 */

(function () {
    'use strict';

    var SINK_URL = 'http://localhost:5001';
    var sinkAvailable = false;  // set to true after ping succeeds

    // Probe once on load to know whether the server is up
    fetch(SINK_URL + '/ping', { method: 'GET' })
        .then(function (r) { return r.json(); })
        .then(function () {
            sinkAvailable = true;
            console.log('[local sink] connected — data will be saved to local disk');
        })
        .catch(function () {
            console.warn('[local sink] NOT running — local disk backup disabled. ' +
                         'Start python_scripts/local_sink.py before the experiment.');
        });

    /**
     * POST a plain JS object (subject or trial) to the sink.
     * @param {string} endpoint  'subject' | 'trial'
     * @param {Object} data
     */
    function sendJSON(endpoint, data) {
        if (!sinkAvailable) return;
        fetch(SINK_URL + '/' + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).catch(function (err) {
            console.warn('[local sink] POST /' + endpoint + ' failed:', err);
        });
    }

    /**
     * POST a binary Blob (audio / csv) to the sink.
     * @param {Blob}   blob
     * @param {string} filename
     * @param {string} subject_id
     * @param {string} file_type  'audio' | 'transcript'
     */
    function sendFile(blob, filename, subject_id, file_type) {
        if (!sinkAvailable) return;
        var form = new FormData();
        form.append('file', blob, filename);
        form.append('filename', filename);
        form.append('subject_id', subject_id);
        form.append('file_type', file_type);
        fetch(SINK_URL + '/file', {
            method: 'POST',
            body: form
        }).catch(function (err) {
            console.warn('[local sink] file upload failed:', err);
        });
    }

    // Expose on window so index_fluency.js can call these
    window.LocalSink = {
        sendSubject: function (data) { sendJSON('subject', data); },
        sendTrial:   function (data) { sendJSON('trial',   data); },
        sendFile:    sendFile
    };
}());
