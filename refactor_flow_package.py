#!/usr/bin/env python3
"""
Flow of Funds Package Refactoring Script
Reorganizes the directory structure for better analysis and navigation
"""

import os
import shutil
from pathlib import Path
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def refactor_flow_package(source_dir):
    """Refactor the Flow of Funds Package directory structure"""

    source_path = Path(source_dir)
    if not source_path.exists():
        logger.error(f"Source directory does not exist: {source_dir}")
        return False

    # Create new organized structure
    new_structure = {
        "01_Financial_Accounts": {
            "description": "All bank and investment account statements",
            "subdirs": ["USAA", "Fidelity", "Fifth_Third", "Robinhood", "Coinbase", "Huntington", "Mercury"]
        },
        "02_Property_Transactions": {
            "description": "Real estate purchases and documentation",
            "subdirs": ["US_Properties", "Colombia_Properties", "Morada_Mami", "Property_Documentation"]
        },
        "03_Wire_Transfers": {
            "description": "All wire transfer records and documentation",
            "subdirs": ["Incoming", "Outgoing", "International"]
        },
        "04_Corporate_Legal": {
            "description": "Corporate governance and legal documents",
            "subdirs": ["Governance", "Litigation", "Member_Actions", "Supporting_Documents"]
        },
        "05_Tax_Financial": {
            "description": "Tax documents and financial analysis",
            "subdirs": ["Tax_Documents", "IRS_Transcripts", "Financial_Analysis"]
        },
        "06_Evidence_Analysis": {
            "description": "Generated analysis and reports",
            "subdirs": ["Reports", "Timelines", "Graphs", "Metadata"]
        }
    }

    # Create backup
    backup_dir = source_path.parent / f"{source_path.name}_backup"
    if not backup_dir.exists():
        logger.info(f"Creating backup at: {backup_dir}")
        shutil.copytree(source_path, backup_dir)

    # Create new organized directory
    refactored_dir = source_path.parent / f"{source_path.name}_refactored"
    if refactored_dir.exists():
        shutil.rmtree(refactored_dir)

    logger.info(f"Creating refactored structure at: {refactored_dir}")
    refactored_dir.mkdir()

    # Create new directory structure
    for main_dir, config in new_structure.items():
        main_path = refactored_dir / main_dir
        main_path.mkdir()

        # Create README for each section
        readme_path = main_path / "README.md"
        with open(readme_path, 'w') as f:
            f.write(f"# {main_dir}\n\n{config['description']}\n\n")
            f.write("## Contents:\n")
            for subdir in config['subdirs']:
                f.write(f"- {subdir}/\n")

        # Create subdirectories
        for subdir in config['subdirs']:
            (main_path / subdir).mkdir()

    # Mapping of old directories to new structure
    directory_mapping = {
        "01_USAA_Statements": "01_Financial_Accounts/USAA",
        "02_Fidelity_Statements": "01_Financial_Accounts/Fidelity",
        "02b_Fifth_Third_Statements": "01_Financial_Accounts/Fifth_Third",
        "02c_Robinhood_Statements": "01_Financial_Accounts/Robinhood",
        "02d_Coinbase_Statements": "01_Financial_Accounts/Coinbase",
        "03_Huntington_Statements": "01_Financial_Accounts/Huntington",
        "03b_Mercury_Statements": "01_Financial_Accounts/Mercury",

        "04_Property_Documentation": "02_Property_Transactions/Property_Documentation",
        "05_Morada_Mami_Purchase": "02_Property_Transactions/Morada_Mami",
        "05a_US_Property_Purchases": "02_Property_Transactions/US_Properties",
        "05b_Alianza_Colombia": "02_Property_Transactions/Colombia_Properties",

        "04_Wire_Transfers": "03_Wire_Transfers/Incoming",

        "06_Supporting_Documents": "04_Corporate_Legal/Supporting_Documents",
        "07_Corporate_Governance": "04_Corporate_Legal/Governance",
        "08_Litigation_Expenses": "04_Corporate_Legal/Litigation",
        "10_Member_Removal_Documentation": "04_Corporate_Legal/Member_Actions",

        "09_Tax_Documents": "05_Tax_Financial/Tax_Documents",

        "evidence_analysis": "06_Evidence_Analysis/Reports",
        "flow_analyzer": "06_Evidence_Analysis/Metadata",
        "flat_output": "06_Evidence_Analysis/Metadata",
        "indexes": "06_Evidence_Analysis/Metadata",
        "metadata": "06_Evidence_Analysis/Metadata"
    }

    # Move directories according to mapping
    for old_dir, new_location in directory_mapping.items():
        old_path = source_path / old_dir
        new_path = refactored_dir / new_location

        if old_path.exists():
            logger.info(f"Moving {old_dir} -> {new_location}")
            if new_path.exists():
                # If destination exists, merge contents
                if old_path.is_dir():
                    for item in old_path.iterdir():
                        dest_item = new_path / item.name
                        if item.is_dir():
                            shutil.copytree(item, dest_item, dirs_exist_ok=True)
                        else:
                            shutil.copy2(item, dest_item)
                else:
                    shutil.copy2(old_path, new_path / old_path.name)
            else:
                shutil.move(str(old_path), str(new_path))

    # Move individual files to appropriate locations
    for item in source_path.iterdir():
        if item.is_file() and item.suffix.lower() in ['.md', '.csv']:
            dest_path = refactored_dir / "06_Evidence_Analysis" / "Reports" / item.name
            logger.info(f"Moving file {item.name} to Reports")
            shutil.copy2(item, dest_path)

    # Create master index
    create_master_index(refactored_dir)

    logger.info(f"Refactoring complete. New structure available at: {refactored_dir}")
    return refactored_dir

def create_master_index(refactored_dir):
    """Create a master index of all contents"""

    index_content = "# Flow of Funds Package - Master Index\n\n"
    index_content += f"Generated: {os.popen('date').read().strip()}\n\n"

    for main_dir in sorted(refactored_dir.iterdir()):
        if main_dir.is_dir():
            index_content += f"## {main_dir.name}\n\n"

            # Count files in each directory
            file_count = sum(1 for _ in main_dir.rglob('*') if _.is_file())
            index_content += f"**Files:** {file_count}\n\n"

            # List subdirectories
            for subdir in sorted(main_dir.iterdir()):
                if subdir.is_dir():
                    subdir_files = sum(1 for _ in subdir.rglob('*') if _.is_file())
                    index_content += f"- `{subdir.name}/` ({subdir_files} files)\n"

            index_content += "\n"

    # Write master index
    index_path = refactored_dir / "MASTER_INDEX.md"
    with open(index_path, 'w') as f:
        f.write(index_content)

    logger.info(f"Created master index: {index_path}")

if __name__ == "__main__":
    source_directory = "/Users/nb/Library/CloudStorage/GoogleDrive-nick@aribia.llc/Other computers/My Mac mini/Flow_of_Funds_Package"
    refactored_path = refactor_flow_package(source_directory)

    if refactored_path:
        print(f"\n✅ Refactoring complete!")
        print(f"📁 Original: {source_directory}")
        print(f"📁 Refactored: {refactored_path}")
        print(f"📁 Backup: {refactored_path.parent / (Path(source_directory).name + '_backup')}")