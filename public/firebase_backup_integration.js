/**
 * Integration Layer: Firebase + Browser Backup
 * =============================================
 * 
 * Add this code to your index_fluency.js to automatically backup data
 * whenever it's sent to Firebase.
 * 
 * This wrapper intercepts Firebase write operations and logs them locally.
 */

// ============================================================================
// ENHANCED FIREBASE FUNCTIONS WITH LOCAL BACKUP
// ============================================================================

/**
 * Enhanced createSubject - now logs to browser backup
 * 
 * Usage: Replace your existing createSubject calls, or use this alongside
 * 
 * Original function (in index_fluency.js):
 *   function createSubject(collection, subject)
 */
function createSubjectWithBackup(collection, subject) {
    if (noSave) {
        return null;
    }
    
    // Log to browser backup BEFORE Firebase write
    if (BrowserBackup && BrowserBackup.isInitialized()) {
        BrowserBackup.logSubject(subject, 'pending').catch(err => {
            console.warn('Failed to backup subject locally:', err);
        });
    }
    
    // Perform Firebase write
    return collection.doc(subject.id).set(subject)
        .then(function () {
            // Update backup status on success
            if (BrowserBackup && BrowserBackup.isInitialized()) {
                BrowserBackup.logSubject({ ...subject, backup_firebase_success: true }, 'success').catch(err => {
                    console.warn('Failed to update backup status:', err);
                });
            }
            console.log(`Subject ${subject.id} saved to Firebase and local backup`);
            return true;
        })
        .catch(function (err) {
            // Log failure
            if (BrowserBackup && BrowserBackup.isInitialized()) {
                BrowserBackup.logSubject({ ...subject, backup_firebase_error: err.message }, 'failed').catch(e => {
                    console.warn('Failed to log error to backup:', e);
                });
            }
            console.error('Failed to save subject to Firebase:', err);
            console.warn('Subject data saved locally for recovery');
            throw err;
        });
}

/**
 * Enhanced recordTrialSubj - now logs to browser backup
 * 
 * Original function (in index_fluency.js):
 *   function recordTrialSubj(collection, subjTrials)
 */
function recordTrialSubjWithBackup(collection, subjTrials) {
    if (noSave) {
        return null;
    }
    
    // Log to browser backup BEFORE Firebase write
    if (BrowserBackup && BrowserBackup.isInitialized()) {
        BrowserBackup.logTrial(subjTrials, 'pending').catch(err => {
            console.warn('Failed to backup trial locally:', err);
        });
    }
    
    // Perform Firebase write
    return collection.doc(subjTrials.id).set(subjTrials)
        .then(function () {
            // Update backup status on success
            if (BrowserBackup && BrowserBackup.isInitialized()) {
                BrowserBackup.logTrial({ ...subjTrials, backup_firebase_success: true }, 'success').catch(err => {
                    console.warn('Failed to update backup status:', err);
                });
            }
            console.log(`Trial ${subjTrials.id} saved to Firebase and local backup`);
            return true;
        })
        .catch(function (err) {
            // Log failure
            if (BrowserBackup && BrowserBackup.isInitialized()) {
                BrowserBackup.logTrial({ ...subjTrials, backup_firebase_error: err.message }, 'failed').catch(e => {
                    console.warn('Failed to log error to backup:', e);
                });
            }
            console.error('Failed to save trial to Firebase:', err);
            console.warn('Trial data saved locally for recovery');
            throw err;
        });
}

/**
 * Enhanced uploadAudio - now logs to browser backup
 * 
 * Usage: Call this when uploading audio files to Firebase Storage
 */
function uploadAudioWithBackup(firebasestorage, audioBlob, subject_id, filename) {
    const filePath = `audio-recordings/${subject_id}/${filename}`;
    
    // Log to browser backup BEFORE Firebase upload
    if (BrowserBackup && BrowserBackup.isInitialized()) {
        BrowserBackup.logFile(filename, audioBlob, subject_id, {
            file_path: filePath,
            type: 'audio',
            size: audioBlob.size,
            timestamp: new Date().toISOString()
        }).catch(err => {
            console.warn('Failed to backup audio locally:', err);
        });
    }
    
    // Perform Firebase upload
    return firebasestorage.child(filePath).put(audioBlob)
        .then(function (snapshot) {
            console.log(`Audio ${filename} uploaded to Firebase and backed up locally`);
            return snapshot;
        })
        .catch(function (err) {
            console.error('Failed to upload audio to Firebase:', err);
            console.warn('Audio file saved locally for recovery');
            throw err;
        });
}

/**
 * Enhanced saveCSV - now logs to browser backup
 * 
 * Usage: Call this when uploading CSV transcripts
 */
function saveCSVWithBackup(firebasestorage, csvBlob, subject_id, filename) {
    const filePath = `transcripts/${subject_id}/${filename}`;
    
    // Log to browser backup BEFORE Firebase upload
    if (BrowserBackup && BrowserBackup.isInitialized()) {
        BrowserBackup.logFile(filename, csvBlob, subject_id, {
            file_path: filePath,
            type: 'transcript',
            size: csvBlob.size,
            timestamp: new Date().toISOString()
        }).catch(err => {
            console.warn('Failed to backup CSV locally:', err);
        });
    }
    
    // Perform Firebase upload
    return firebasestorage.child(filePath).put(csvBlob)
        .then(function (snapshot) {
            console.log(`CSV ${filename} uploaded to Firebase and backed up locally`);
            return snapshot;
        })
        .catch(function (err) {
            console.error('Failed to upload CSV to Firebase:', err);
            console.warn('CSV file saved locally for recovery');
            throw err;
        });
}

// ============================================================================
// RECOVERY & MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Check what data has been backed up locally
 */
async function checkLocalBackup() {
    if (!BrowserBackup || !BrowserBackup.isInitialized()) {
        console.warn('BrowserBackup not available');
        return;
    }
    
    try {
        const stats = await BrowserBackup.getBackupStats();
        const storage = await BrowserBackup.getStorageInfo();
        
        console.log('=== LOCAL BACKUP STATUS ===');
        console.log(`Subjects backed up: ${stats.subjects_count}`);
        console.log(`Trials backed up: ${stats.trials_count}`);
        console.log(`Operations logged: ${stats.operations_logged}`);
        console.log(`Storage used: ${(storage.usage / (1024 * 1024)).toFixed(2)} MB of ${(storage.quota / (1024 * 1024)).toFixed(2)} MB`);
        console.log(`Storage available: ${storage.percentage_used.toFixed(1)}% used`);
        
        return stats;
    } catch (err) {
        console.error('Error checking backup status:', err);
    }
}

/**
 * Export all local backup data to JSON file
 * Useful for downloading before experiment ends
 */
function exportLocalBackup() {
    if (!BrowserBackup || !BrowserBackup.isInitialized()) {
        console.warn('BrowserBackup not available');
        return;
    }
    
    try {
        BrowserBackup.exportToJSON();
        console.log('Local backup exported to JSON file');
    } catch (err) {
        console.error('Error exporting backup:', err);
    }
}

/**
 * Export trial data to CSV for analysis
 */
function exportTrialsAsCSV() {
    if (!BrowserBackup || !BrowserBackup.isInitialized()) {
        console.warn('BrowserBackup not available');
        return;
    }
    
    try {
        BrowserBackup.exportTrialsToCSV();
        console.log('Trials exported to CSV file');
    } catch (err) {
        console.error('Error exporting CSV:', err);
    }
}

/**
 * Get all backed up subjects
 */
async function getBackedUpSubjects() {
    if (!BrowserBackup || !BrowserBackup.isInitialized()) {
        console.warn('BrowserBackup not available');
        return [];
    }
    
    try {
        return await BrowserBackup.getSubjects();
    } catch (err) {
        console.error('Error retrieving backed up subjects:', err);
        return [];
    }
}

/**
 * Get all backed up trials
 */
async function getBackedUpTrials(subject_id = null) {
    if (!BrowserBackup || !BrowserBackup.isInitialized()) {
        console.warn('BrowserBackup not available');
        return [];
    }
    
    try {
        return await BrowserBackup.getTrials(subject_id);
    } catch (err) {
        console.error('Error retrieving backed up trials:', err);
        return [];
    }
}

/**
 * Disable local backup (for testing purposes)
 */
function disableLocalBackup() {
    if (BrowserBackup) {
        BrowserBackup.setEnabled(false);
        console.log('Local backup disabled');
    }
}

/**
 * Enable local backup
 */
function enableLocalBackup() {
    if (BrowserBackup) {
        BrowserBackup.setEnabled(true);
        console.log('Local backup enabled');
    }
}

/**
 * Clear all local backup data (use with caution!)
 */
function clearLocalBackup(confirm = false) {
    if (!confirm) {
        console.warn('Local backup clear requested but not confirmed. Call with confirm=true');
        return;
    }
    
    if (!BrowserBackup || !BrowserBackup.isInitialized()) {
        console.warn('BrowserBackup not available');
        return;
    }
    
    try {
        BrowserBackup.clearAll();
        console.log('Local backup cleared');
    } catch (err) {
        console.error('Error clearing backup:', err);
    }
}

// ============================================================================
// SETUP INSTRUCTIONS
// ============================================================================

/**
 * HOW TO USE THIS INTEGRATION:
 * 
 * 1. AUTOMATIC LOGGING:
 *    - This script auto-initializes BrowserBackup on page load
 *    - browser_backup.js must be loaded before index_fluency.js
 * 
 * 2. MODIFY YOUR CODE:
 *    In your index_fluency.js, find where you call:
 *    - firestore.collection("Subjects").doc(subject.id).set(subject)
 *    - firestore.collection("Trials").doc(subjTrials.id).set(subjTrials)
 *    - firebasestorage.child("audio-recordings/...").put(audioBlob)
 *    - firebasestorage.child("transcripts/...").put(csvBlob)
 * 
 *    And replace them with:
 *    - createSubjectWithBackup(collection, subject)
 *    - recordTrialSubjWithBackup(collection, subjTrials)
 *    - uploadAudioWithBackup(firebasestorage, audioBlob, subject_id, filename)
 *    - saveCSVWithBackup(firebasestorage, csvBlob, subject_id, filename)
 * 
 * 3. MONITOR BACKUP:
 *    In browser console, run:
 *    - checkLocalBackup()              // See what's backed up
 *    - exportLocalBackup()             // Download all data as JSON
 *    - exportTrialsAsCSV()             // Download trials as CSV
 *    - getBackedUpTrials("subject_id") // Get specific subject trials
 * 
 * 4. IF FIREBASE WRITE FAILS:
 *    - Data is automatically saved in local browser storage
 *    - Use exportLocalBackup() or exportTrialsAsCSV() to recover
 *    - OR use the Python backup script to download from Firebase when available
 */
