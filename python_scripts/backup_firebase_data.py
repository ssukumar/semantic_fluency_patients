#!/usr/bin/env python3
"""
Enhanced Firebase Data Backup Script
=====================================
Comprehensively backs up all experiment data from Firebase (Firestore + Cloud Storage)
to local disk to prevent data loss.

Usage:
    python backup_firebase_data.py                    # Single backup
    python backup_firebase_data.py --schedule 3600    # Backup every 60 minutes
    python backup_firebase_data.py --config backup_config.json

Features:
    - Downloads all Subjects and Trials from Firestore
    - Downloads all audio files and transcripts from Cloud Storage
    - Creates timestamped backup directories
    - Maintains backup history
    - Comprehensive error logging
    - Dry-run mode for testing
"""

import os
import sys
import csv
import json
import time
import shutil
import logging
import argparse
import firebase_admin
from datetime import datetime
from firebase_admin import credentials, firestore, storage
from pathlib import Path

# ============================================================================
# CONFIGURATION
# ============================================================================

CREDENTIALS_PATH = 'memory-recall-5223c-firebase-adminsdk-mui1b-b99187600d.json'
BACKUP_BASE_DIR = '../local_backups'
LOG_DIR = '../logs'
DEFAULT_CONFIG = {
    'firestore_collections': ['Subjects', 'Trials'],
    'storage_folders': {
        'audio-recordings': 'audio',
        'transcripts': 'transcripts'
    },
    'backup_retention_days': 30,  # Keep backups for 30 days
    'include_raw_json': True,  # Export raw JSON in addition to CSV
}

# ============================================================================
# LOGGING SETUP
# ============================================================================

def setup_logging():
    """Configure logging to file and console."""
    os.makedirs(LOG_DIR, exist_ok=True)
    
    log_file = os.path.join(
        LOG_DIR, 
        f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
    )
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    logger = logging.getLogger(__name__)
    logger.info(f"Backup logging started. Log file: {log_file}")
    return logger

logger = setup_logging()

# ============================================================================
# FIREBASE INITIALIZATION
# ============================================================================

def initialize_firebase():
    """Initialize Firebase app with credentials."""
    try:
        if not firebase_admin._apps:
            cred = credentials.Certificate(CREDENTIALS_PATH)
            firebase_admin.initialize_app(cred)
            logger.info("Firebase initialized successfully")
        return firestore.client(), storage.bucket()
    except Exception as e:
        logger.error(f"Failed to initialize Firebase: {e}")
        raise

# ============================================================================
# FIRESTORE BACKUP
# ============================================================================

def backup_firestore_collection(db, collection_name, backup_dir):
    """
    Download all documents from a Firestore collection and save as CSV + JSON.
    
    Args:
        db: Firestore client
        collection_name: Name of collection to backup
        backup_dir: Directory to save backup files
    
    Returns:
        dict with backup status and stats
    """
    logger.info(f"Backing up Firestore collection: {collection_name}")
    
    try:
        docs = db.collection(collection_name).stream()
        
        documents = []
        all_keys = set()
        
        # Collect all documents and all possible keys
        for doc in docs:
            doc_dict = doc.to_dict()
            doc_dict['_id'] = doc.id  # Include document ID
            documents.append(doc_dict)
            all_keys.update(doc_dict.keys())
        
        if not documents:
            logger.warning(f"No documents found in {collection_name}")
            return {
                'collection': collection_name,
                'status': 'empty',
                'doc_count': 0
            }
        
        # Save as JSON (complete data)
        json_file = os.path.join(backup_dir, f"{collection_name}.json")
        with open(json_file, 'w') as f:
            json.dump(documents, f, indent=2, default=str)
        logger.info(f"  Saved JSON: {json_file} ({len(documents)} documents)")
        
        # Save as CSV (tabular format)
        csv_file = os.path.join(backup_dir, f"{collection_name}.csv")
        with open(csv_file, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=sorted(all_keys))
            writer.writeheader()
            writer.writerows(documents)
        logger.info(f"  Saved CSV: {csv_file}")
        
        return {
            'collection': collection_name,
            'status': 'success',
            'doc_count': len(documents),
            'json_file': json_file,
            'csv_file': csv_file
        }
        
    except Exception as e:
        logger.error(f"Error backing up {collection_name}: {e}")
        return {
            'collection': collection_name,
            'status': 'failed',
            'error': str(e)
        }

# ============================================================================
# CLOUD STORAGE BACKUP
# ============================================================================

def backup_cloud_storage(storage_bucket, backup_dir, storage_config):
    """
    Download all files from Cloud Storage folders to local backup.
    
    Args:
        storage_bucket: Firebase Storage bucket
        backup_dir: Directory to save backup files
        storage_config: Dict mapping {remote_folder: local_folder_name}
    
    Returns:
        dict with backup status and stats
    """
    logger.info(f"Backing up Cloud Storage")
    
    results = {}
    
    for remote_folder, local_folder in storage_config.items():
        logger.info(f"  Processing storage folder: {remote_folder}")
        
        try:
            local_path = os.path.join(backup_dir, local_folder)
            os.makedirs(local_path, exist_ok=True)
            
            # List all blobs in folder
            blobs = storage_bucket.list_blobs(prefix=remote_folder + '/')
            blob_list = list(blobs)
            
            if not blob_list:
                logger.warning(f"    No files found in {remote_folder}/")
                results[remote_folder] = {
                    'status': 'empty',
                    'file_count': 0
                }
                continue
            
            # Download each file
            downloaded = 0
            failed = 0
            
            for blob in blob_list:
                try:
                    # Create relative path preserving structure
                    relative_path = blob.name.replace(remote_folder + '/', '')
                    local_file = os.path.join(local_path, relative_path)
                    
                    # Create subdirectories as needed
                    os.makedirs(os.path.dirname(local_file), exist_ok=True)
                    
                    # Download file
                    blob.download_to_filename(local_file)
                    downloaded += 1
                    
                except Exception as e:
                    logger.error(f"      Failed to download {blob.name}: {e}")
                    failed += 1
            
            results[remote_folder] = {
                'status': 'success',
                'file_count': len(blob_list),
                'downloaded': downloaded,
                'failed': failed,
                'local_path': local_path
            }
            logger.info(f"    Downloaded {downloaded}/{len(blob_list)} files to {local_path}")
            
        except Exception as e:
            logger.error(f"  Error backing up {remote_folder}: {e}")
            results[remote_folder] = {
                'status': 'failed',
                'error': str(e)
            }
    
    return results

# ============================================================================
# BACKUP MANAGEMENT
# ============================================================================

def cleanup_old_backups(backup_base_dir, retention_days):
    """
    Delete backups older than retention period.
    
    Args:
        backup_base_dir: Base backup directory
        retention_days: Number of days to keep backups
    """
    try:
        cutoff_time = time.time() - (retention_days * 86400)
        deleted_count = 0
        
        for backup_dir in os.listdir(backup_base_dir):
            backup_path = os.path.join(backup_base_dir, backup_dir)
            
            if os.path.isdir(backup_path) and backup_dir.startswith('backup_'):
                dir_mtime = os.path.getmtime(backup_path)
                
                if dir_mtime < cutoff_time:
                    logger.info(f"Deleting old backup: {backup_dir}")
                    shutil.rmtree(backup_path)
                    deleted_count += 1
        
        if deleted_count > 0:
            logger.info(f"Cleaned up {deleted_count} old backup(s)")
    
    except Exception as e:
        logger.error(f"Error during cleanup: {e}")

def create_backup_manifest(backup_dir, results, config):
    """
    Create a manifest file documenting what was backed up.
    
    Args:
        backup_dir: Backup directory path
        results: Results from backup operations
        config: Configuration used
    """
    manifest = {
        'timestamp': datetime.now().isoformat(),
        'backup_dir': backup_dir,
        'config': config,
        'results': results
    }
    
    manifest_file = os.path.join(backup_dir, 'BACKUP_MANIFEST.json')
    with open(manifest_file, 'w') as f:
        json.dump(manifest, f, indent=2)
    
    logger.info(f"Created manifest: {manifest_file}")
    return manifest_file

# ============================================================================
# MAIN BACKUP FUNCTION
# ============================================================================

def perform_backup(config=None, dry_run=False):
    """
    Execute complete Firebase backup.
    
    Args:
        config: Configuration dict (uses DEFAULT_CONFIG if None)
        dry_run: If True, only report what would be backed up
    
    Returns:
        dict with complete backup results
    """
    if config is None:
        config = DEFAULT_CONFIG
    
    logger.info("=" * 70)
    logger.info("Starting Firebase data backup")
    logger.info("=" * 70)
    
    # Create timestamped backup directory
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_dir = os.path.join(BACKUP_BASE_DIR, f'backup_{timestamp}')
    os.makedirs(backup_dir, exist_ok=True)
    logger.info(f"Backup directory: {backup_dir}")
    
    if dry_run:
        logger.info("DRY RUN MODE - No files will be written")
    
    try:
        # Initialize Firebase
        db, storage_bucket = initialize_firebase()
        
        all_results = {
            'timestamp': timestamp,
            'backup_dir': backup_dir,
            'dry_run': dry_run,
            'firestore': {},
            'storage': {},
            'manifest': None
        }
        
        # Backup Firestore collections
        logger.info("\n--- Backing up Firestore Collections ---")
        for collection in config.get('firestore_collections', []):
            if not dry_run:
                result = backup_firestore_collection(db, collection, backup_dir)
                all_results['firestore'][collection] = result
            else:
                logger.info(f"  [DRY RUN] Would backup collection: {collection}")
        
        # Backup Cloud Storage
        logger.info("\n--- Backing up Cloud Storage ---")
        if not dry_run:
            storage_results = backup_cloud_storage(
                storage_bucket, 
                backup_dir, 
                config.get('storage_folders', {})
            )
            all_results['storage'] = storage_results
        else:
            logger.info(f"  [DRY RUN] Would backup storage folders: {list(config.get('storage_folders', {}).keys())}")
        
        # Create manifest
        if not dry_run:
            all_results['manifest'] = create_backup_manifest(backup_dir, all_results, config)
        
        # Cleanup old backups
        if not dry_run:
            logger.info("\n--- Cleaning up old backups ---")
            cleanup_old_backups(BACKUP_BASE_DIR, config.get('backup_retention_days', 30))
        
        logger.info("\n" + "=" * 70)
        logger.info("Backup completed successfully")
        logger.info("=" * 70)
        
        return all_results
    
    except Exception as e:
        logger.error(f"Backup failed: {e}")
        raise

# ============================================================================
# SCHEDULING
# ============================================================================

def run_scheduled_backups(interval_seconds, config=None):
    """
    Run backups on a schedule.
    
    Args:
        interval_seconds: Seconds between backups
        config: Configuration dict
    """
    logger.info(f"Starting scheduled backups every {interval_seconds} seconds")
    
    try:
        while True:
            perform_backup(config=config)
            logger.info(f"Next backup in {interval_seconds} seconds...")
            time.sleep(interval_seconds)
    
    except KeyboardInterrupt:
        logger.info("Scheduled backups interrupted by user")
    except Exception as e:
        logger.error(f"Scheduled backup error: {e}")
        raise

# ============================================================================
# CLI & MAIN
# ============================================================================

def main():
    """Command-line interface for backup script."""
    parser = argparse.ArgumentParser(
        description='Backup Firebase experiment data locally',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Single backup
  python backup_firebase_data.py
  
  # Continuous backups every 60 minutes
  python backup_firebase_data.py --schedule 3600
  
  # Use custom config
  python backup_firebase_data.py --config my_config.json
  
  # Dry run (don't download)
  python backup_firebase_data.py --dry-run
        """
    )
    
    parser.add_argument(
        '--schedule',
        type=int,
        help='Run backups on schedule (interval in seconds)'
    )
    parser.add_argument(
        '--config',
        type=str,
        help='Path to custom config JSON file'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Report what would be backed up without downloading'
    )
    
    args = parser.parse_args()
    
    # Load config if provided
    config = DEFAULT_CONFIG.copy()
    if args.config:
        try:
            with open(args.config, 'r') as f:
                config.update(json.load(f))
            logger.info(f"Loaded config from {args.config}")
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            sys.exit(1)
    
    try:
        if args.schedule:
            # Scheduled backups
            run_scheduled_backups(args.schedule, config=config)
        else:
            # Single backup
            results = perform_backup(config=config, dry_run=args.dry_run)
            
            # Print summary
            print("\n" + "=" * 70)
            print("BACKUP SUMMARY")
            print("=" * 70)
            print(json.dumps(results, indent=2, default=str))
    
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
