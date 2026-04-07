/**
 * Browser-Side Data Backup Module
 * ================================
 * Local backup of all experiment data sent to Firebase
 * Provides fallback protection in case Firebase write fails
 * 
 * Features:
 * - IndexedDB storage for large data sets (audio, transcripts)
 * - LocalStorage for metadata and trial info
 * - CSV export functionality for analysis
 * - Real-time logging of all Firebase operations
 * 
 * Usage:
 *   BrowserBackup.init();                      // Initialize on page load
 *   BrowserBackup.logSubject(subjectData);     // Log subject data
 *   BrowserBackup.logTrial(trialData);         // Log trial data
 *   BrowserBackup.logFile(filename, data);     // Log audio/file data
 *   BrowserBackup.exportToCSV();               // Export all data as CSV
 */

const BrowserBackup = (function() {
    'use strict';
    
    const DB_NAME = 'ExperimentDataBackup_v1';
    const DB_VERSION = 1;
    
    const STORES = {
        SUBJECTS: 'subjects',
        TRIALS: 'trials',
        FILES: 'files',
        OPERATIONS_LOG: 'operations_log'
    };
    
    let db = null;
    let isEnabled = true;
    let operationLog = [];
    
    // ========================================================================
    // INITIALIZATION
    // ========================================================================
    
    /**
     * Initialize IndexedDB and set up storage
     */
    function init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onerror = () => {
                console.warn('BrowserBackup: Failed to open IndexedDB', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                db = request.result;
                console.log('BrowserBackup: IndexedDB initialized successfully');
                resolve(db);
            };
            
            request.onupgradeneeded = (event) => {
                db = event.target.result;
                
                // Create object stores if they don't exist
                if (!db.objectStoreNames.contains(STORES.SUBJECTS)) {
                    db.createObjectStore(STORES.SUBJECTS, { keyPath: 'id' });
                    console.log('BrowserBackup: Created object store for subjects');
                }
                
                if (!db.objectStoreNames.contains(STORES.TRIALS)) {
                    const trialsStore = db.createObjectStore(STORES.TRIALS, { keyPath: 'id' });
                    trialsStore.createIndex('subject_id', 'subject_id', { unique: false });
                    console.log('BrowserBackup: Created object store for trials');
                }
                
                if (!db.objectStoreNames.contains(STORES.FILES)) {
                    const filesStore = db.createObjectStore(STORES.FILES, { keyPath: 'id', autoIncrement: true });
                    filesStore.createIndex('subject_id', 'subject_id', { unique: false });
                    filesStore.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('BrowserBackup: Created object store for files');
                }
                
                if (!db.objectStoreNames.contains(STORES.OPERATIONS_LOG)) {
                    db.createObjectStore(STORES.OPERATIONS_LOG, { keyPath: 'id', autoIncrement: true });
                    console.log('BrowserBackup: Created object store for operations log');
                }
            };
        });
    }
    
    // ========================================================================
    // SUBJECT DATA LOGGING
    // ========================================================================
    
    /**
     * Log subject data to local storage
     * @param {Object} subjectData - Subject information
     * @param {string} firebaseOperation - 'pending', 'success', or 'failed'
     */
    function logSubject(subjectData, firebaseOperation = 'pending') {
        if (!isEnabled || !db) return Promise.reject('BrowserBackup not initialized');
        
        const record = {
            ...subjectData,
            local_backup_timestamp: new Date().toISOString(),
            firebase_operation_status: firebaseOperation
        };
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORES.SUBJECTS], 'readwrite');
            const store = transaction.objectStore(STORES.SUBJECTS);
            const request = store.put(record);
            
            request.onsuccess = () => {
                logOperation('SUBJECT_SAVED', {
                    subject_id: subjectData.id,
                    firebase_status: firebaseOperation,
                    local_timestamp: record.local_backup_timestamp
                });
                console.log(`BrowserBackup: Subject ${subjectData.id} saved to local storage`);
                resolve(record);
            };
            
            request.onerror = () => {
                console.error('BrowserBackup: Failed to save subject', request.error);
                reject(request.error);
            };
        });
    }
    
    // ========================================================================
    // TRIAL DATA LOGGING
    // ========================================================================
    
    /**
     * Log trial data to local storage
     * @param {Object} trialData - Trial/response information
     * @param {string} firebaseOperation - 'pending', 'success', or 'failed'
     */
    function logTrial(trialData, firebaseOperation = 'pending') {
        if (!isEnabled || !db) return Promise.reject('BrowserBackup not initialized');
        
        const record = {
            ...trialData,
            local_backup_timestamp: new Date().toISOString(),
            firebase_operation_status: firebaseOperation
        };
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORES.TRIALS], 'readwrite');
            const store = transaction.objectStore(STORES.TRIALS);
            const request = store.put(record);
            
            request.onsuccess = () => {
                logOperation('TRIAL_SAVED', {
                    trial_id: trialData.id,
                    subject_id: trialData.subject_id || trialData.subjID,
                    firebase_status: firebaseOperation,
                    local_timestamp: record.local_backup_timestamp
                });
                console.log(`BrowserBackup: Trial ${trialData.id} saved to local storage`);
                resolve(record);
            };
            
            request.onerror = () => {
                console.error('BrowserBackup: Failed to save trial', request.error);
                reject(request.error);
            };
        });
    }
    
    // ========================================================================
    // FILE & BINARY DATA LOGGING
    // ========================================================================
    
    /**
     * Log binary file (audio, transcript) to local storage
     * @param {string} filename - File name
     * @param {Blob|ArrayBuffer} data - File data
     * @param {string} subject_id - Subject ID
     * @param {Object} metadata - Additional metadata
     */
    function logFile(filename, data, subject_id, metadata = {}) {
        if (!isEnabled || !db) return Promise.reject('BrowserBackup not initialized');
        
        // Convert data to Blob if needed
        let blob = data instanceof Blob ? data : new Blob([data]);
        
        const record = {
            filename: filename,
            subject_id: subject_id,
            file_size: blob.size,
            file_type: blob.type,
            timestamp: new Date().toISOString(),
            blob: blob,
            metadata: metadata
        };
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORES.FILES], 'readwrite');
            const store = transaction.objectStore(STORES.FILES);
            const request = store.add(record);
            
            request.onsuccess = () => {
                logOperation('FILE_SAVED', {
                    filename: filename,
                    subject_id: subject_id,
                    file_size: blob.size,
                    local_timestamp: record.timestamp
                });
                console.log(`BrowserBackup: File ${filename} saved to local storage (${(blob.size / 1024).toFixed(2)} KB)`);
                resolve(record);
            };
            
            request.onerror = () => {
                console.error('BrowserBackup: Failed to save file', request.error);
                reject(request.error);
            };
        });
    }
    
    // ========================================================================
    // OPERATIONS LOGGING
    // ========================================================================
    
    /**
     * Internal: Log all backup operations for audit trail
     */
    function logOperation(operation_type, details) {
        if (!isEnabled || !db) return;
        
        const log_entry = {
            operation_type: operation_type,
            details: details,
            timestamp: new Date().toISOString()
        };
        
        operationLog.push(log_entry);
        
        // Also store in IndexedDB for persistence
        const transaction = db.transaction([STORES.OPERATIONS_LOG], 'readwrite');
        const store = transaction.objectStore(STORES.OPERATIONS_LOG);
        store.add(log_entry);
    }
    
    /**
     * Get all operations performed
     */
    function getOperationLog() {
        return new Promise((resolve, reject) => {
            if (!db) return reject('BrowserBackup not initialized');
            
            const transaction = db.transaction([STORES.OPERATIONS_LOG], 'readonly');
            const store = transaction.objectStore(STORES.OPERATIONS_LOG);
            const request = store.getAll();
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = () => {
                reject(request.error);
            };
        });
    }
    
    // ========================================================================
    // DATA RETRIEVAL & EXPORT
    // ========================================================================
    
    /**
     * Get all subjects from local backup
     */
    function getSubjects() {
        return new Promise((resolve, reject) => {
            if (!db) return reject('BrowserBackup not initialized');
            
            const transaction = db.transaction([STORES.SUBJECTS], 'readonly');
            const store = transaction.objectStore(STORES.SUBJECTS);
            const request = store.getAll();
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        });
    }
    
    /**
     * Get all trials for a specific subject
     */
    function getTrials(subject_id) {
        return new Promise((resolve, reject) => {
            if (!db) return reject('BrowserBackup not initialized');
            
            const transaction = db.transaction([STORES.TRIALS], 'readonly');
            const store = transaction.objectStore(STORES.TRIALS);
            
            if (subject_id) {
                const index = store.index('subject_id');
                const request = index.getAll(subject_id);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } else {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            }
        });
    }
    
    /**
     * Get backup statistics
     */
    async function getBackupStats() {
        const subjects = await getSubjects();
        const trials = await getTrials();
        const logs = await getOperationLog();
        
        return {
            subjects_count: subjects.length,
            trials_count: trials.length,
            operations_logged: logs.length,
            storage_available: await getStorageInfo()
        };
    }
    
    /**
     * Get browser storage quota info
     */
    function getStorageInfo() {
        if (navigator.storage && navigator.storage.estimate) {
            return navigator.storage.estimate().then(estimate => ({
                quota: estimate.quota,
                usage: estimate.usage,
                available: estimate.quota - estimate.usage,
                percentage_used: (estimate.usage / estimate.quota) * 100
            }));
        }
        return Promise.resolve({ error: 'Storage API not available' });
    }
    
    /**
     * Export all data as JSON file
     */
    async function exportToJSON() {
        const subjects = await getSubjects();
        const trials = await getTrials();
        const operations = await getOperationLog();
        
        const exportData = {
            export_timestamp: new Date().toISOString(),
            subjects: subjects,
            trials: trials,
            operations: operations,
            stats: await getBackupStats()
        };
        
        // Create download link
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `experiment_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('BrowserBackup: JSON export downloaded');
    }
    
    /**
     * Export trial data as CSV
     */
    async function exportTrialsToCSV() {
        const trials = await getTrials();
        
        if (trials.length === 0) {
            console.warn('BrowserBackup: No trials to export');
            return;
        }
        
        // Get all unique keys across all trials
        const allKeys = new Set();
        trials.forEach(trial => {
            Object.keys(trial).forEach(key => allKeys.add(key));
        });
        
        const headers = Array.from(allKeys);
        let csv = headers.join(',') + '\n';
        
        trials.forEach(trial => {
            const row = headers.map(header => {
                const value = trial[header];
                // Escape CSV values
                if (typeof value === 'string') {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value !== undefined ? value : '';
            });
            csv += row.join(',') + '\n';
        });
        
        // Create download link
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `trials_backup_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('BrowserBackup: CSV export downloaded');
    }
    
    /**
     * Download a file from local backup
     */
    function downloadFile(filename, subject_id) {
        return new Promise((resolve, reject) => {
            if (!db) return reject('BrowserBackup not initialized');
            
            const transaction = db.transaction([STORES.FILES], 'readonly');
            const store = transaction.objectStore(STORES.FILES);
            const index = store.index('subject_id');
            const request = index.getAll(subject_id);
            
            request.onsuccess = () => {
                const files = request.result;
                const fileRecord = files.find(f => f.filename === filename);
                
                if (fileRecord && fileRecord.blob) {
                    const url = URL.createObjectURL(fileRecord.blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    resolve(true);
                } else {
                    reject(`File ${filename} not found in backup`);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }
    
    // ========================================================================
    // CLEAR & RESET
    // ========================================================================
    
    /**
     * Clear all local backup data
     */
    function clearAll() {
        if (!db) return Promise.reject('BrowserBackup not initialized');
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(
                [STORES.SUBJECTS, STORES.TRIALS, STORES.FILES, STORES.OPERATIONS_LOG],
                'readwrite'
            );
            
            Object.values(STORES).forEach(storeName => {
                transaction.objectStore(storeName).clear();
            });
            
            transaction.oncomplete = () => {
                console.log('BrowserBackup: All data cleared');
                resolve();
            };
            
            transaction.onerror = () => {
                reject(transaction.error);
            };
        });
    }
    
    /**
     * Disable/enable backup
     */
    function setEnabled(enabled) {
        isEnabled = enabled;
        console.log(`BrowserBackup: ${enabled ? 'Enabled' : 'Disabled'}`);
    }
    
    // ========================================================================
    // PUBLIC API
    // ========================================================================
    
    return {
        // Initialization
        init: init,
        setEnabled: setEnabled,
        
        // Logging
        logSubject: logSubject,
        logTrial: logTrial,
        logFile: logFile,
        
        // Retrieval
        getSubjects: getSubjects,
        getTrials: getTrials,
        getOperationLog: getOperationLog,
        getBackupStats: getBackupStats,
        getStorageInfo: getStorageInfo,
        
        // Export
        exportToJSON: exportToJSON,
        exportTrialsToCSV: exportTrialsToCSV,
        downloadFile: downloadFile,
        
        // Management
        clearAll: clearAll,
        
        // Status
        isInitialized: () => db !== null,
        isEnabled: () => isEnabled
    };
})();

// Auto-initialize on DOMContentLoaded if not in test mode
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        BrowserBackup.init().catch(err => {
            console.warn('BrowserBackup: Initialization failed', err);
        });
    });
} else {
    BrowserBackup.init().catch(err => {
        console.warn('BrowserBackup: Initialization failed', err);
    });
}
