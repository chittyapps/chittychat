#!/usr/bin/env python3
"""
Remove duplicate files from Flow_of_Funds_Package
Focus on obvious temp/cache duplicates first
"""

import os
import shutil
from pathlib import Path

def cleanup_temp_duplicates(directory):
    """Remove obvious temp and duplicate directories"""

    base_path = Path(directory)
    removed_dirs = []
    saved_space = 0

    # Directories to remove (temp/cache/duplicate locations)
    temp_dirs_to_remove = [
        "temp_downloads",
        "temp_discovery",
        "temp_unzipped",
        ".venv",
        "venv",
        "__pycache__",
        ".git",
        "node_modules"
    ]

    print(f"Cleaning up temporary directories in: {directory}")

    for root, dirs, files in os.walk(base_path):
        for dir_name in dirs:
            if dir_name in temp_dirs_to_remove:
                dir_path = Path(root) / dir_name
                try:
                    # Calculate size before removal
                    dir_size = sum(f.stat().st_size for f in dir_path.rglob('*') if f.is_file())
                    saved_space += dir_size

                    print(f"Removing: {dir_path}")
                    shutil.rmtree(dir_path)
                    removed_dirs.append(str(dir_path))

                except Exception as e:
                    print(f"Error removing {dir_path}: {e}")

    print(f"\nRemoved {len(removed_dirs)} directories")
    print(f"Saved approximately {saved_space / (1024*1024*1024):.2f} GB")

    return removed_dirs, saved_space

def remove_duplicate_files():
    """Remove files that are obviously duplicated"""

    # Focus on genie-avb which has most duplicates
    genie_path = "/Users/nb/Library/CloudStorage/GoogleDrive-nick@aribia.llc/Other computers/My Mac mini/Flow_of_Funds_Package/04_Property_Documentation/All_Lease_Agreements/Additional_Leases/genie-avb"

    if Path(genie_path).exists():
        print(f"Cleaning up genie-avb duplicates...")
        removed_dirs, saved = cleanup_temp_duplicates(genie_path)

        # Also remove duplicate python environments
        for python_dir in Path(genie_path).rglob("lib/python*"):
            if python_dir.is_dir() and "site-packages" in str(python_dir):
                try:
                    shutil.rmtree(python_dir.parent.parent)
                    print(f"Removed Python environment: {python_dir.parent.parent}")
                except:
                    pass

if __name__ == "__main__":
    source = "/Users/nb/Library/CloudStorage/GoogleDrive-nick@aribia.llc/Other computers/My Mac mini/Flow_of_Funds_Package"

    print("🧹 Starting cleanup of temporary and duplicate files...")

    # Clean up temp directories
    removed_dirs, saved_space = cleanup_temp_duplicates(source)

    # Special cleanup for genie-avb
    remove_duplicate_files()

    print(f"\n✅ Cleanup complete!")
    print(f"📁 Removed {len(removed_dirs)} temporary directories")
    print(f"💾 Saved {saved_space / (1024*1024*1024):.2f} GB of space")