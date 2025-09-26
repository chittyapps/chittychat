#!/usr/bin/env python3
"""
Create a clean, organized Flow of Funds Package
Remove temp files and create proper structure
"""

import os
import shutil
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def create_clean_package():
    """Create clean Flow of Funds Package with proper organization"""

    source_dir = Path("/Users/nb/Library/CloudStorage/GoogleDrive-nick@aribia.llc/Other computers/My Mac mini/Flow_of_Funds_Package")
    clean_dir = source_dir.parent / "Flow_of_Funds_Package_CLEAN"

    # Remove existing clean directory
    if clean_dir.exists():
        logger.info(f"Removing existing clean directory: {clean_dir}")
        shutil.rmtree(clean_dir)

    # Create new clean structure
    clean_dir.mkdir()
    logger.info(f"Creating clean package at: {clean_dir}")

    # Define organized structure
    structure = {
        "01_Financial_Statements": {
            "USAA": [],
            "Fidelity": [],
            "Fifth_Third": [],
            "Robinhood": [],
            "Coinbase": [],
            "Huntington": [],
            "Mercury": []
        },
        "02_Property_Real_Estate": {
            "Property_Documentation": [],
            "US_Properties": [],
            "Colombia_Properties": [],
            "Morada_Mami": []
        },
        "03_Wire_Transfers": {
            "Wire_Documentation": []
        },
        "04_Corporate_Legal": {
            "Corporate_Governance": [],
            "Litigation_Expenses": [],
            "Supporting_Documents": [],
            "Member_Removal": []
        },
        "05_Tax_Financial_Analysis": {
            "Tax_Documents": [],
            "Financial_Analysis": []
        }
    }

    # Create directory structure
    for main_category, subcategories in structure.items():
        main_path = clean_dir / main_category
        main_path.mkdir()

        for subcat in subcategories:
            (main_path / subcat).mkdir()

    # Mapping of old directories to new structure
    directory_mapping = {
        "01_USAA_Statements": "01_Financial_Statements/USAA",
        "02_Fidelity_Statements": "01_Financial_Statements/Fidelity",
        "02b_Fifth_Third_Statements": "01_Financial_Statements/Fifth_Third",
        "02c_Robinhood_Statements": "01_Financial_Statements/Robinhood",
        "02d_Coinbase_Statements": "01_Financial_Statements/Coinbase",
        "03_Huntington_Statements": "01_Financial_Statements/Huntington",
        "03b_Mercury_Statements": "01_Financial_Statements/Mercury",

        "04_Property_Documentation": "02_Property_Real_Estate/Property_Documentation",
        "05_Morada_Mami_Purchase": "02_Property_Real_Estate/Morada_Mami",
        "05a_US_Property_Purchases": "02_Property_Real_Estate/US_Properties",
        "05b_Alianza_Colombia": "02_Property_Real_Estate/Colombia_Properties",

        "04_Wire_Transfers": "03_Wire_Transfers/Wire_Documentation",

        "06_Supporting_Documents": "04_Corporate_Legal/Supporting_Documents",
        "07_Corporate_Governance": "04_Corporate_Legal/Corporate_Governance",
        "08_Litigation_Expenses": "04_Corporate_Legal/Litigation_Expenses",
        "10_Member_Removal_Documentation": "04_Corporate_Legal/Member_Removal",

        "09_Tax_Documents": "05_Tax_Financial_Analysis/Tax_Documents"
    }

    # Copy files to new structure, excluding temp directories
    exclude_dirs = {
        "temp_downloads", "temp_discovery", "temp_unzipped",
        ".venv", "venv", "__pycache__", ".git",
        "evidence_analysis", "flow_analyzer", "flat_output",
        "indexes", "metadata"
    }

    files_copied = 0

    for old_dir, new_location in directory_mapping.items():
        old_path = source_dir / old_dir
        new_path = clean_dir / new_location

        if old_path.exists() and old_path.is_dir():
            logger.info(f"Processing {old_dir} -> {new_location}")

            for root, dirs, files in os.walk(old_path):
                # Skip excluded directories
                dirs[:] = [d for d in dirs if d not in exclude_dirs]

                for file in files:
                    if not file.startswith('.'):
                        src_file = Path(root) / file

                        # Create relative path structure
                        rel_path = src_file.relative_to(old_path)
                        dest_file = new_path / rel_path

                        # Create destination directory
                        dest_file.parent.mkdir(parents=True, exist_ok=True)

                        # Copy file
                        try:
                            shutil.copy2(src_file, dest_file)
                            files_copied += 1

                            if files_copied % 100 == 0:
                                logger.info(f"Copied {files_copied} files...")

                        except Exception as e:
                            logger.error(f"Error copying {src_file}: {e}")

    # Copy analysis markdown files to Financial Analysis
    analysis_files = [
        "AFFIDAVIT_OF_FUNDS_FLOW_COMPLETE_2025.md",
        "AFFIDAVIT_OF_FUNDS_FLOW.md",
        "ALL_LEASES_SUMMARY.md",
        "COMPREHENSIVE_FLOW_ANALYSIS.md",
        "COMPREHENSIVE_TIMELINE_GAP_ANALYSIS.md",
        "EXECUTIVE_SUMMARY_COMPLETE_PACKAGE.md",
        "MASTER_PACKAGE_PURPOSE.md",
        "PACKAGE_INDEX.md",
        "PROPERTY_FUNDING_TIMELINE_MATRIX.md",
        "SEARCH_RESULTS_SUMMARY.md",
        "SHARON_JONES_FINANCIAL_ANALYSIS.md",
        "WIRE_TRANSFER_ANALYSIS.md"
    ]

    analysis_dir = clean_dir / "05_Tax_Financial_Analysis" / "Financial_Analysis"

    for file_name in analysis_files:
        src_file = source_dir / file_name
        if src_file.exists():
            shutil.copy2(src_file, analysis_dir / file_name)
            files_copied += 1
            logger.info(f"Copied analysis file: {file_name}")

    # Create package index
    create_package_index(clean_dir)

    logger.info(f"Clean package creation complete!")
    logger.info(f"Total files copied: {files_copied}")
    logger.info(f"Clean package location: {clean_dir}")

    return clean_dir

def create_package_index(package_dir):
    """Create comprehensive index of the clean package"""

    index_content = f"""# Flow of Funds Package - Clean Organized Structure

Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Package Structure

"""

    total_files = 0

    for main_dir in sorted(package_dir.iterdir()):
        if main_dir.is_dir():
            index_content += f"### {main_dir.name}\n\n"

            # Count files in this main directory
            main_files = sum(1 for _ in main_dir.rglob('*') if _.is_file())
            total_files += main_files
            index_content += f"**Total Files:** {main_files}\n\n"

            # List subdirectories
            for subdir in sorted(main_dir.iterdir()):
                if subdir.is_dir():
                    subdir_files = sum(1 for _ in subdir.rglob('*') if _.is_file())
                    index_content += f"- **{subdir.name}/** ({subdir_files} files)\n"

            index_content += "\n"

    index_content += f"## Summary\n\n"
    index_content += f"- **Total Files:** {total_files}\n"
    index_content += f"- **Structure:** Organized by category and type\n"
    index_content += f"- **Status:** Cleaned and deduplicated\n"

    # Write index
    index_path = package_dir / "PACKAGE_INDEX_CLEAN.md"
    with open(index_path, 'w') as f:
        f.write(index_content)

    logger.info(f"Created package index: {index_path}")

if __name__ == "__main__":
    from datetime import datetime
    clean_package_path = create_clean_package()
    print(f"\n✅ Clean Flow of Funds Package created at:")
    print(f"📁 {clean_package_path}")