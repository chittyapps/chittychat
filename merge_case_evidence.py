#!/usr/bin/env python3
"""
Merge all related case evidence into a single comprehensive analysis
"""

import os
import shutil
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def merge_all_case_evidence():
    """Merge all evidence directories into one comprehensive case"""

    # All evidence sources for the same case
    evidence_sources = [
        "/Users/nb/Library/CloudStorage/GoogleDrive-nick@aribia.llc/Other computers/My Mac mini/Flow_of_Funds_Package",
        "/Users/nb/Library/CloudStorage/GoogleDrive-nick@aribia.llc/Other computers/My Mac mini/Projects/ChittyTrace - IT CAN BE LLC",
        "/Users/nb/Library/CloudStorage/GoogleDrive-nick@aribia.llc/Other computers/My Mac mini/Downloads/tax_communications",
        "/Users/nb/Library/CloudStorage/GoogleDrive-nick@aribia.llc/Other computers/My Mac mini/Downloads",
        "/Users/nb/Library/CloudStorage/GoogleDrive-nick@aribia.llc/Other computers/My Mac mini/INBOX",
        "/Users/nb/Library/CloudStorage/GoogleDrive-nick@aribia.llc/Other computers/My Mac mini/thumb"
    ]

    # Create master evidence directory
    master_evidence_dir = Path("/Users/nb/Library/CloudStorage/GoogleDrive-nick@aribia.llc/Other computers/My Mac mini/MASTER_CASE_EVIDENCE_2024D007847")

    if master_evidence_dir.exists():
        shutil.rmtree(master_evidence_dir)

    master_evidence_dir.mkdir()
    logger.info(f"Created master evidence directory: {master_evidence_dir}")

    # Create organized structure
    categories = {
        "01_Flow_of_Funds": "Flow_of_Funds_Package",
        "02_ChittyTrace_Systems": "ChittyTrace - IT CAN BE LLC",
        "03_Tax_Communications": "tax_communications",
        "04_Downloads_Evidence": "Downloads",
        "05_Inbox_Materials": "INBOX",
        "06_Thumb_Evidence": "thumb"
    }

    total_files = 0

    for category, source_name in categories.items():
        category_dir = master_evidence_dir / category
        category_dir.mkdir()

        # Find matching source directory
        source_dir = None
        for source in evidence_sources:
            if source_name in source:
                source_dir = Path(source)
                break

        if source_dir and source_dir.exists():
            logger.info(f"Processing {source_name} -> {category}")

            # Copy all files, excluding temp directories
            exclude_patterns = {'.git', '__pycache__', '.venv', 'venv', 'temp_', 'node_modules'}

            for root, dirs, files in os.walk(source_dir):
                # Filter out excluded directories
                dirs[:] = [d for d in dirs if not any(pattern in d for pattern in exclude_patterns)]

                for file in files:
                    if not file.startswith('.') and not any(pattern in file for pattern in exclude_patterns):
                        src_file = Path(root) / file

                        # Create relative path
                        try:
                            rel_path = src_file.relative_to(source_dir)
                            dest_file = category_dir / rel_path

                            # Create destination directory
                            dest_file.parent.mkdir(parents=True, exist_ok=True)

                            # Copy file
                            shutil.copy2(src_file, dest_file)
                            total_files += 1

                            if total_files % 500 == 0:
                                logger.info(f"Copied {total_files} files...")

                        except Exception as e:
                            logger.warning(f"Error copying {src_file}: {e}")

    logger.info(f"Master evidence compilation complete! Total files: {total_files}")
    return master_evidence_dir

if __name__ == "__main__":
    master_dir = merge_all_case_evidence()
    print(f"\n✅ Master case evidence created at:")
    print(f"📁 {master_dir}")
    print(f"\nReady for comprehensive analysis!")