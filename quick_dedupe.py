#!/usr/bin/env python3
"""
Quick deduplication using file size and name patterns
"""

import os
from pathlib import Path
from collections import defaultdict

def quick_dedupe_by_size_and_name(directory):
    """Quick deduplication by file size and similar names"""

    print(f"Quick scan of: {directory}")

    # Group by size first (much faster than hashing)
    size_groups = defaultdict(list)

    for file_path in Path(directory).rglob('*'):
        if file_path.is_file() and not file_path.name.startswith('.'):
            try:
                size = file_path.stat().st_size
                size_groups[size].append(file_path)
            except:
                continue

    # Find potential duplicates (same size)
    potential_dupes = {size: paths for size, paths in size_groups.items() if len(paths) > 1}

    print(f"Found {len(potential_dupes)} groups of files with same size")

    # Look for obvious duplicates
    obvious_dupes = []
    for size, files in potential_dupes.items():
        if size > 0:  # Skip empty files
            # Group by filename (ignoring path)
            name_groups = defaultdict(list)
            for f in files:
                name_groups[f.name].append(f)

            # Files with identical names are likely duplicates
            for name, paths in name_groups.items():
                if len(paths) > 1:
                    obvious_dupes.append((name, size, paths))

    print(f"Found {len(obvious_dupes)} obvious duplicate groups")

    total_dupes = 0
    total_savings = 0

    for name, size, paths in obvious_dupes:
        print(f"\nDuplicate: {name} ({size} bytes)")
        for i, path in enumerate(paths):
            if i == 0:
                print(f"  KEEP: {path}")
            else:
                print(f"  DUPE: {path}")
                total_dupes += 1
                total_savings += size

    print(f"\nTotal duplicate files: {total_dupes}")
    print(f"Total space wasted: {total_savings / (1024*1024):.2f} MB")

    return obvious_dupes

if __name__ == "__main__":
    source = "/Users/nb/Library/CloudStorage/GoogleDrive-nick@aribia.llc/Other computers/My Mac mini/Flow_of_Funds_Package"
    quick_dedupe_by_size_and_name(source)