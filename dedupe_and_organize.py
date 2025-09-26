#!/usr/bin/env python3
"""
Deduplicate and organize Flow of Funds Package
Remove duplicates and create clean structure
"""

import os
import hashlib
from pathlib import Path
import logging
from collections import defaultdict

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def calculate_file_hash(file_path):
    """Calculate SHA-256 hash of file"""
    hash_sha256 = hashlib.sha256()
    try:
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_sha256.update(chunk)
        return hash_sha256.hexdigest()
    except Exception as e:
        logger.error(f"Error hashing {file_path}: {e}")
        return None

def find_duplicates(directory):
    """Find duplicate files by hash"""
    logger.info(f"Scanning for duplicates in: {directory}")

    file_hashes = defaultdict(list)
    total_files = 0

    for file_path in Path(directory).rglob('*'):
        if file_path.is_file() and not file_path.name.startswith('.'):
            total_files += 1
            if total_files % 100 == 0:
                logger.info(f"Processed {total_files} files...")

            file_hash = calculate_file_hash(file_path)
            if file_hash:
                file_hashes[file_hash].append(file_path)

    # Find duplicates
    duplicates = {hash_val: paths for hash_val, paths in file_hashes.items() if len(paths) > 1}

    logger.info(f"Found {len(duplicates)} sets of duplicate files")
    logger.info(f"Total duplicate files: {sum(len(paths) - 1 for paths in duplicates.values())}")

    return duplicates

def remove_duplicates(duplicates, dry_run=True):
    """Remove duplicate files, keeping the first one found"""
    removed_count = 0
    saved_space = 0

    for file_hash, file_paths in duplicates.items():
        # Keep the first file, remove the rest
        keep_file = file_paths[0]
        remove_files = file_paths[1:]

        logger.info(f"Keeping: {keep_file}")

        for remove_file in remove_files:
            try:
                file_size = remove_file.stat().st_size
                saved_space += file_size

                if not dry_run:
                    remove_file.unlink()
                    logger.info(f"Removed: {remove_file}")
                else:
                    logger.info(f"Would remove: {remove_file}")

                removed_count += 1

            except Exception as e:
                logger.error(f"Error removing {remove_file}: {e}")

    logger.info(f"{'Would remove' if dry_run else 'Removed'} {removed_count} duplicate files")
    logger.info(f"{'Would save' if dry_run else 'Saved'} {saved_space / (1024*1024):.2f} MB")

    return removed_count, saved_space

def organize_by_type(directory):
    """Organize files by type and importance"""

    base_path = Path(directory)
    organized_path = base_path.parent / f"{base_path.name}_organized"

    if organized_path.exists():
        import shutil
        shutil.rmtree(organized_path)

    organized_path.mkdir()

    # Create organization structure
    categories = {
        'Financial_Statements': ['.pdf', '.xlsx', '.xls', '.csv'],
        'Legal_Documents': ['.pdf', '.docx', '.doc'],
        'Analysis_Reports': ['.md', '.txt', '.json'],
        'Images_Scans': ['.jpg', '.jpeg', '.png', '.tiff', '.tif'],
        'Archives': ['.zip', '.rar', '.7z'],
        'Other': []
    }

    # Create category directories
    for category in categories:
        (organized_path / category).mkdir()

    # Move files to categories
    moved_files = 0
    for file_path in base_path.rglob('*'):
        if file_path.is_file() and not file_path.name.startswith('.'):
            file_ext = file_path.suffix.lower()

            # Find appropriate category
            target_category = 'Other'
            for category, extensions in categories.items():
                if file_ext in extensions:
                    target_category = category
                    break

            # Create subdirectory based on original location
            relative_path = file_path.relative_to(base_path)
            target_subdir = organized_path / target_category / relative_path.parent
            target_subdir.mkdir(parents=True, exist_ok=True)

            # Move file
            target_file = target_subdir / file_path.name
            if not target_file.exists():
                import shutil
                shutil.copy2(file_path, target_file)
                moved_files += 1

                if moved_files % 50 == 0:
                    logger.info(f"Organized {moved_files} files...")

    logger.info(f"Organized {moved_files} files into: {organized_path}")
    return organized_path

if __name__ == "__main__":
    source_dir = "/Users/nb/Library/CloudStorage/GoogleDrive-nick@aribia.llc/Other computers/My Mac mini/Flow_of_Funds_Package"

    print("🔍 Finding duplicates...")
    duplicates = find_duplicates(source_dir)

    print("\n📊 Duplicate Analysis (DRY RUN):")
    remove_duplicates(duplicates, dry_run=True)

    # Ask user confirmation
    response = input("\nRemove duplicates? (y/N): ")
    if response.lower() == 'y':
        print("\n🗑️  Removing duplicates...")
        remove_duplicates(duplicates, dry_run=False)

    print("\n📁 Organizing files by type...")
    organized_path = organize_by_type(source_dir)

    print(f"\n✅ Complete! Organized files available at: {organized_path}")