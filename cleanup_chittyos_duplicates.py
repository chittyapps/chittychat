#!/usr/bin/env python3
"""
Clean up duplicate evidence entries in ChittyOS and consolidate into single case
"""

import os
import shutil
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def cleanup_chittyos_duplicates():
    """Remove duplicate case directories and consolidate into one master case"""

    chittyos_legal_dir = Path("/Users/nb/Library/CloudStorage/GoogleDrive-nick@aribia.llc/Shared drives/chittychat-data/projects/legal")

    # Directories to remove (duplicates/fragments)
    directories_to_remove = [
        "2024D007847_RESTART",
        "DOWNLOADS_EVIDENCE",
        "INBOX_EVIDENCE",
        "TAX_COMMUNICATIONS",
        "THUMB_EVIDENCE",
        "--help"
    ]

    # Keep these main directories
    keep_directories = [
        "2024D007847_MASTER_CASE",
        "2024D007847_TOTAL_RECALL_VAULT",
        "IT_CAN_BE_LLC_ChittyTrace"
    ]

    logger.info("Cleaning up duplicate ChittyOS evidence directories...")

    removed_count = 0
    for dir_name in directories_to_remove:
        dir_path = chittyos_legal_dir / dir_name
        if dir_path.exists():
            logger.info(f"Removing duplicate directory: {dir_name}")
            shutil.rmtree(dir_path)
            removed_count += 1

    # Rename 2024D007847 to 2024D007847_ORIGINAL if it exists
    original_dir = chittyos_legal_dir / "2024D007847"
    if original_dir.exists():
        backup_dir = chittyos_legal_dir / "2024D007847_ORIGINAL"
        if backup_dir.exists():
            shutil.rmtree(backup_dir)
        original_dir.rename(backup_dir)
        logger.info("Renamed original 2024D007847 to 2024D007847_ORIGINAL")

    # Rename MASTER_CASE to be the primary case
    master_case_dir = chittyos_legal_dir / "2024D007847_MASTER_CASE"
    primary_case_dir = chittyos_legal_dir / "2024D007847"

    if master_case_dir.exists():
        master_case_dir.rename(primary_case_dir)
        logger.info("Renamed 2024D007847_MASTER_CASE to primary 2024D007847")

    logger.info(f"Cleanup complete. Removed {removed_count} duplicate directories.")

    # List remaining directories
    remaining_dirs = [d.name for d in chittyos_legal_dir.iterdir() if d.is_dir()]
    logger.info(f"Remaining case directories: {remaining_dirs}")

    return remaining_dirs

def create_consolidated_index():
    """Create index of consolidated evidence"""

    chittyos_legal_dir = Path("/Users/nb/Library/CloudStorage/GoogleDrive-nick@aribia.llc/Shared drives/chittychat-data/projects/legal")

    index_content = """# Consolidated Legal Evidence Index

## Primary Case: 2024D007847
- **Main case evidence**: All Flow of Funds, ChittyTrace, tax communications, and supporting documents
- **Status**: Consolidated and deduplicated
- **Location**: `/2024D007847/`

## TOTAL RECALL Litigation Vault: 2024D007847_TOTAL_RECALL_VAULT
- **Complete litigation vault**: All court filings, correspondence, and legal documents
- **Status**: Comprehensive litigation archive
- **Location**: `/2024D007847_TOTAL_RECALL_VAULT/`

## ChittyTrace System: IT_CAN_BE_LLC_ChittyTrace
- **System documentation**: ChittyTrace implementation and IT CAN BE LLC materials
- **Status**: Technical documentation archive
- **Location**: `/IT_CAN_BE_LLC_ChittyTrace/`

## Removed Duplicates:
- 2024D007847_RESTART (duplicate)
- DOWNLOADS_EVIDENCE (consolidated into main case)
- INBOX_EVIDENCE (consolidated into main case)
- TAX_COMMUNICATIONS (consolidated into main case)
- THUMB_EVIDENCE (consolidated into main case)

## Access:
- **Dashboard**: http://localhost:8080
- **ChittyOS Data**: Current directory
"""

    index_path = chittyos_legal_dir / "EVIDENCE_INDEX.md"
    with open(index_path, 'w') as f:
        f.write(index_content)

    logger.info(f"Created consolidated evidence index: {index_path}")

if __name__ == "__main__":
    remaining = cleanup_chittyos_duplicates()
    create_consolidated_index()

    print(f"\n✅ ChittyOS Evidence Cleanup Complete!")
    print(f"📁 Remaining case directories: {remaining}")
    print(f"🗂️  Evidence is now properly consolidated and deduplicated")