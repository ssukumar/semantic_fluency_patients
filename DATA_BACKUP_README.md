# Firebase Data Backup System

This comprehensive backup system ensures you never lose experiment data. It provides both **browser-side** and **server-side** backup mechanisms.

## Overview

Your experiment sends data to Firebase in three categories:

| Data Type | Storage | Backup Coverage |
|-----------|---------|-----------------|
| **Subject Demographics** | Firestore "Subjects" | ✅ Both methods |
| **Trial Results** | Firestore "Trials" | ✅ Both methods |
| **Audio Recordings** | Cloud Storage | ✅ Both methods |
| **Transcript CSVs** | Cloud Storage | ✅ Both methods |

---

## 1. Browser-Side Backup (Real-time, In-Browser)

### What It Does
- Automatically backs up all data to your browser's IndexedDB **before** sending to Firebase
- Provides instant protection against network failures
- Allows data recovery directly from the browser console
- Exports data as JSON and CSV files

### Features
✅ Automatic logging to IndexedDB  
✅ Zero configuration needed  
✅ Handles Firebase write failures gracefully  
✅ Export to JSON for archiving  
✅ Export trials to CSV for analysis  
✅ Download individual backed-up files  
✅ Real-time operation tracking  

### Files Included

| File | Purpose |
|------|---------|
| `public/browser_backup.js` | Core backup library (auto-initializes) |
| `public/firebase_backup_integration.js` | Integration layer with Firebase functions |
| `public/index.html` | Updated to load backup scripts |

### How to Use

#### Option A: Automatic (Minimal Code Changes)
If you want minimal changes to your existing code, the browser backup will automatically log any data you manually pass to it:

```javascript
// In your index_fluency.js, after Firebase writes succeed:

// After createSubject() succeeds
await BrowserBackup.logSubject(subject);

// After recordTrialSubj() succeeds
await BrowserBackup.logTrial(trial);

// After audio upload succeeds
await BrowserBackup.logFile(filename, audioBlob, subject_id);
```

#### Option B: Complete Integration (Recommended)
For automatic backup on every Firebase write, use the enhanced functions:

```javascript
// Replace your existing Firebase calls with these:

// Instead of: firestore.collection("Subjects").doc(subject.id).set(subject)
// Use:
createSubjectWithBackup(firestore.collection("Subjects"), subject);

// Instead of: firestore.collection("Trials").doc(trial.id).set(trial)
// Use:
recordTrialSubjWithBackup(firestore.collection("Trials"), trial);

// Instead of: firebasestorage.child("audio-recordings/...").put(blob)
// Use:
uploadAudioWithBackup(firebasestorage, audioBlob, subject_id, filename);

// Instead of: firebasestorage.child("transcripts/...").put(csvBlob)
// Use:
saveCSVWithBackup(firebasestorage, csvBlob, subject_id, filename);
```

### Monitor & Manage Backup

**In the browser console (F12), you can run:**

```javascript
// Check backup status
await checkLocalBackup();
// Output:
// === LOCAL BACKUP STATUS ===
// Subjects backed up: 5
// Trials backed up: 45
// Operations logged: 150
// Storage used: 12.34 MB of 50.00 MB
// Storage available: 24.6% used

// Export all data to JSON file
exportLocalBackup();  // Downloads as experiment_backup_YYYY-MM-DD.json

// Export trials to CSV for analysis
exportTrialsAsCSV();  // Downloads as trials_backup_YYYY-MM-DD.csv

// Get all backed-up trials for a subject
const trials = await getBackedUpTrials("subject_123");
console.log(trials);

// Get all backed-up subjects
const subjects = await getBackedUpSubjects();
console.log(subjects);

// View operation history
const logs = await BrowserBackup.getOperationLog();
console.log(logs);

// Check storage quota
const storage = await BrowserBackup.getStorageInfo();
console.log(storage);
```

### Limitations
- **Browser storage is limited** (~50 MB per site, varies by browser)
- **Data is local to the browser** - cleared if user clears browser storage
- **Not suitable for large binary files** alone
- **For permanent backup**, use the Python script (see below)

---

## 2. Server-Side Backup (Python Script)

### What It Does
- Downloads complete copies of Firestore collections to local disk
- Saves all audio files and transcripts from Cloud Storage
- Creates timestamped backup directories for version control
- Automatically cleans up old backups to save space
- Can run on a schedule (e.g., daily backups)
- Exports data as both JSON and CSV for easy analysis

### Features
✅ Complete Firestore export (JSON + CSV)  
✅ Cloud Storage file downloads  
✅ Timestamped backup directories  
✅ Automatic cleanup (maintains last 30 days)  
✅ Scheduled backup support  
✅ Comprehensive error logging  
✅ Dry-run mode for testing  
✅ Operation manifest for audit trail  

### Files Included

| File | Purpose |
|------|---------|
| `python_scripts/backup_firebase_data.py` | Main backup script |
| `python_scripts/backup_config.json` | Configuration file |
| `python_scripts/memory-recall-5223c-firebase-adminsdk-mui1b-b99187600d.json` | Firebase credentials (already present) |

### Prerequisites

```bash
# Ensure Python Firebase Admin SDK is installed
pip install firebase-admin
```

### How to Use

#### Single Backup
```bash
cd python_scripts/
python backup_firebase_data.py
```

This creates a timestamped backup directory at:
```
../local_backups/backup_YYYYMMDD_HHMMSS/
├── Subjects.json               # Raw Firestore subjects
├── Subjects.csv                # Subjects as table
├── Trials.json                 # Raw Firestore trials
├── Trials.csv                  # Trials as table
├── audio/                      # Audio recordings
│   └── subject_id/
│       └── subject_id-category-timestamp.webm
├── transcripts/                # CSV transcripts
│   └── subject_id/
│       └── subject_id-category-timestamp.csv
└── BACKUP_MANIFEST.json        # Backup metadata & timestamp
```

#### Scheduled Backups (Every Hour)
```bash
python backup_firebase_data.py --schedule 3600
```

#### With Custom Config
```bash
python backup_firebase_data.py --config backup_config.json
```

#### Dry Run (See What Would Be Backed Up)
```bash
python backup_firebase_data.py --dry-run
```

### Configuration

Edit `python_scripts/backup_config.json`:

```json
{
  "firestore_collections": ["Subjects", "Trials"],
  "storage_folders": {
    "audio-recordings": "audio",
    "transcripts": "transcripts"
  },
  "backup_retention_days": 30,
  "include_raw_json": true
}
```

| Setting | Purpose | Default |
|---------|---------|---------|
| `firestore_collections` | Which collections to backup | `["Subjects", "Trials"]` |
| `storage_folders` | Cloud Storage folders to backup | Maps remote → local folder |
| `backup_retention_days` | Keep backups for N days, delete older | `30` |
| `include_raw_json` | Export raw JSON in addition to CSV | `true` |

### Output Structure

```
../local_backups/
├── backup_20260406_150000/
│   ├── Subjects.json
│   ├── Subjects.csv
│   ├── Trials.json
│   ├── Trials.csv
│   ├── audio/
│   ├── transcripts/
│   └── BACKUP_MANIFEST.json
├── backup_20260405_150000/
├── backup_20260404_150000/
└── logs/
    ├── backup_20260406_150000.log
    ├── backup_20260405_150000.log
    └── backup_20260404_150000.log
```

### Automate with Cron (macOS/Linux)

```bash
# Edit crontab: crontab -e

# Backup every day at 2 AM
0 2 * * * cd /Users/shruthi/Documents/Postdoc/experiment_folders/semantic_fluency_patients/python_scripts && python backup_firebase_data.py >> ../logs/cron_backups.log 2>&1

# Backup every 6 hours
0 */6 * * * cd /Users/shruthi/Documents/Postdoc/experiment_folders/semantic_fluency_patients/python_scripts && python backup_firebase_data.py >> ../logs/cron_backups.log 2>&1
```

### View Logs

```bash
# See what was backed up in last run
tail -50 ../logs/backup_*.log

# Follow live backup
tail -f ../logs/backup_YYYYMMDD_HHMMSS.log
```

---

## 3. Data Recovery Scenarios

### Scenario 1: Firebase Write Failed, Need Browser Data

```javascript
// In browser console:

// Export all data to JSON
exportLocalBackup();

// Or export just trials to CSV
exportTrialsAsCSV();

// Or get specific data to inspect
const trials = await getBackedUpTrials("subject_id");
console.log(trials);
```

### Scenario 2: Need Complete Backup of All Data

```bash
# Run Python script
cd python_scripts/
python backup_firebase_data.py

# Browse backups
ls -lah ../local_backups/backup_*/
```

### Scenario 3: Recover Specific Audio/Transcript File

```javascript
// In browser console (if browser backup enabled)
await BrowserBackup.downloadFile("filename", "subject_id");

// Or download from disk after Python backup
ls -lah ../local_backups/backup_LATEST/audio/subject_id/
ls -lah ../local_backups/backup_LATEST/transcripts/subject_id/
```

### Scenario 4: Firebase Rules Expire Soon (April 26, 2026)

⚠️ **ACTION REQUIRED**: Your Firestore rules expire soon!

```bash
# Run a complete backup immediately
cd python_scripts/
python backup_firebase_data.py

# Then update your Firebase rules in:
# firebase.json -> firestore section
```

---

## 4. Combining Both Methods (Recommended)

For maximum data safety, use **both** systems:

1. **Browser backup** = instant, real-time protection
2. **Python backup** = long-term archival, scheduled downloads

### Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ Experiment Runs                                              │
├─────────────────────────────────────────────────────────────┤
│ ↓ Data entry                                                 │
│ ↓ Automatic browser backup (IndexedDB)                      │
│ ↓ Send to Firebase                                           │
└─────────────────────────────────────────────────────────────┘
           ↓ Every 6 hours (scheduled)
┌─────────────────────────────────────────────────────────────┐
│ Python Backup Script                                         │
├─────────────────────────────────────────────────────────────┤
│ • Download Firestore collections                             │
│ • Download all audio files                                  │
│ • Download all transcripts                                  │
│ • Save to local_backups/backup_YYYYMMDD_HHMMSS/            │
│ • Clean up backups older than 30 days                       │
└─────────────────────────────────────────────────────────────┘
           ↓ Manual export when needed
┌─────────────────────────────────────────────────────────────┐
│ Archive for Analysis                                         │
├─────────────────────────────────────────────────────────────┤
│ • Research backups by date                                  │
│ • Export CSV for statistical analysis                       │
│ • Share data with collaborators                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Troubleshooting

### Browser Backup Not Working

```javascript
// Check if initialized
console.log(BrowserBackup.isInitialized());  // Should be true

// Check if enabled
console.log(BrowserBackup.isEnabled());  // Should be true

// Try manually initializing
await BrowserBackup.init();

// Check browser console for errors
// (F12 → Console tab)
```

### Python Script Fails

```bash
# Check Firebase credentials
ls -la python_scripts/memory-recall-5223c-firebase-adminsdk-mui1b-b99187600d.json

# Verify Firebase connection
cd python_scripts/
python -c "import firebase_admin; from firebase_admin import credentials; print('Firebase available')"

# Run in dry-run mode to debug
python backup_firebase_data.py --dry-run

# Check logs
tail -100 ../logs/backup_*.log | grep -i error
```

### Storage Quota Exceeded

Browser backup has ~50 MB limit:

```javascript
// Check storage usage
const storage = await BrowserBackup.getStorageInfo();
console.log(`Using: ${storage.percentage_used.toFixed(1)}%`);

// If over quota, export and clear
exportLocalBackup();          // Save current data
await BrowserBackup.clearAll(); // Free space
```

---

## 6. Quick Reference

### Browser Backup Console Commands

```javascript
// Status
await checkLocalBackup()                          // Show stats
await BrowserBackup.getStorageInfo()             // Show storage usage

// Export
exportLocalBackup()                               // Export as JSON
exportTrialsAsCSV()                               // Export as CSV
await BrowserBackup.downloadFile(fname, subj_id) // Download file

// Query
await getBackedUpSubjects()                      // Get all subjects
await getBackedUpTrials("subject_id")            // Get subject trials
await BrowserBackup.getOperationLog()            // View all operations

// Control
enableLocalBackup()                               // Resume backup
disableLocalBackup()                              // Pause backup
clearLocalBackup(true)                            // Clear all (warning!)
```

### Python Script Commands

```bash
# Basic
python backup_firebase_data.py                    # Single backup
python backup_firebase_data.py --dry-run         # Preview only
python backup_firebase_data.py --schedule 3600   # Every 1 hour

# Config
python backup_firebase_data.py --config backup_config.json

# Management
ls -lah ../local_backups/                        # List backups
cat ../logs/backup_*.log                         # View logs
# Manually delete old backups (keeps last 30 days automatically)
```

---

## 7. Security Notes

⚠️ **Important**

- Firebase credentials file is in `python_scripts/` - keep it safe
- Browser backup is stored locally in IndexedDB - not encrypted
- Don't commit credentials file to Git
- For sensitive data, encrypt backups after download

---

## 8. File Summary

| File | Location | Purpose |
|------|----------|---------|
| `browser_backup.js` | `public/` | Client-side backup library |
| `firebase_backup_integration.js` | `public/` | Integration wrapper functions |
| `backup_firebase_data.py` | `python_scripts/` | Server-side backup script |
| `backup_config.json` | `python_scripts/` | Backup configuration |
| `index.html` | `public/` | Updated to load backup scripts |

---

## 9. Getting Help

- Check console for error messages: **F12** → **Console** tab
- Review logs: `cat ../logs/backup_*.log`
- Test dry-run mode: `python backup_firebase_data.py --dry-run`
- Verify Firebase: check `firebase.json` and rules

---

## Summary

Your data is now protected by:

✅ **Browser Backup** - Automatic, real-time protection (includes all data before Firebase write)  
✅ **Python Backup** - Scheduled downloads (complete archive with full history)  
✅ **Dual Recovery** - Export from browser OR download from disk  
✅ **Error Handling** - Graceful failure with local data preservation  

**Never lose data again!** 🎉
