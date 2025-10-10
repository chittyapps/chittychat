#!/usr/bin/env python3
"""
ChittyOS Evidence CLI - Single Path Evidence Management
Official evidence processing tool for ChittyOS platform
"""

import os
import sys
import json
import hashlib
import argparse
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

class ChittyOSEvidenceCLI:
    """Single path evidence management for ChittyOS"""

    def __init__(self):
        self.chittyos_data = os.getenv('CHITTYOS_DATA_DIR',
            '/Users/nb/Library/CloudStorage/GoogleDrive-nick@jeanarlene.com/Shared drives/ChittyOS-Data')
        self.case_data = os.getenv('CASE_DATA_DIR',
            '/Users/nb/Library/CloudStorage/GoogleDrive-nick@jeanarlene.com/Shared drives/Arias V Bianchi')

        # Validate directories
        if not os.path.exists(self.chittyos_data):
            raise FileNotFoundError(f"ChittyOS data directory not found: {self.chittyos_data}")

        self.metadata_dir = os.path.join(self.chittyos_data, 'METADATA')
        self.vault_dir = os.path.join(self.chittyos_data, 'VAULT')

        # Ensure required directories exist
        os.makedirs(self.metadata_dir, exist_ok=True)
        os.makedirs(self.vault_dir, exist_ok=True)

    def generate_file_hash(self, file_path: str) -> str:
        """Generate SHA-256 hash for file integrity"""
        hasher = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hasher.update(chunk)
        return hasher.hexdigest()

    def create_evidence_metadata(self, file_path: str) -> Dict:
        """Create evidence metadata structure"""
        file_stat = os.stat(file_path)
        filename = os.path.basename(file_path)

        metadata = {
            "chitty_id": None,  # To be filled by ChittyID service
            "filename": filename,
            "file_path": file_path,
            "file_size": file_stat.st_size,
            "file_hash": self.generate_file_hash(file_path),
            "created_at": datetime.fromtimestamp(file_stat.st_ctime).isoformat(),
            "modified_at": datetime.fromtimestamp(file_stat.st_mtime).isoformat(),
            "processed_at": datetime.now().isoformat(),
            "case_id": "ARIAS_V_BIANCHI",
            "evidence_type": self.classify_evidence(filename),
            "priority": self.assess_priority(filename),
            "status": "pending_chittyid"
        }

        return metadata

    def classify_evidence(self, filename: str) -> str:
        """Classify evidence type based on filename patterns"""
        filename_lower = filename.lower()

        if any(pattern in filename for pattern in ["ENTERED", "Order"]):
            return "court_order"
        elif any(pattern in filename for pattern in ["FILED", "Petition", "Response"]):
            return "court_filing"
        elif "Financial Affidavit" in filename:
            return "financial_disclosure"
        elif any(pattern in filename for pattern in ["Operating Agreement", "LLC"]):
            return "corporate_document"
        elif "Lease Agreement" in filename:
            return "lease_document"
        elif any(pattern in filename for pattern in ["Deed", "Mortgage"]):
            return "property_document"
        elif "Tax Return" in filename:
            return "tax_document"
        elif any(pattern in filename for pattern in ["Wire", "Receipt", "Statement"]):
            return "financial_transaction"
        elif filename_lower.endswith(('.jpg', '.jpeg', '.png')):
            return "photograph"
        elif filename_lower.endswith('.pdf'):
            return "legal_document"
        elif filename_lower.endswith(('.xlsx', '.csv')):
            return "financial_data"
        else:
            return "general_evidence"

    def assess_priority(self, filename: str) -> str:
        """Assess evidence priority for processing"""
        high_priority_patterns = [
            "ENTERED", "FILED", "Financial Affidavit",
            "Operating Agreement", "Deed", "Mortgage"
        ]

        if any(pattern in filename for pattern in high_priority_patterns):
            return "high"
        elif any(pattern in filename for pattern in ["Lease", "Tax Return", "Wire"]):
            return "medium"
        else:
            return "low"

    def list_evidence(self, case_filter: Optional[str] = None) -> List[Dict]:
        """List all evidence with optional case filtering"""
        evidence_list = []

        for metadata_file in Path(self.metadata_dir).glob("*.json"):
            try:
                with open(metadata_file, 'r') as f:
                    metadata = json.load(f)

                if case_filter and metadata.get('case_id') != case_filter:
                    continue

                evidence_list.append(metadata)
            except (json.JSONDecodeError, IOError) as e:
                print(f"Warning: Could not read metadata file {metadata_file}: {e}")

        return sorted(evidence_list, key=lambda x: x.get('processed_at', ''))

    def scan_case_directory(self) -> List[str]:
        """Scan case directory for new evidence"""
        if not os.path.exists(self.case_data):
            print(f"Warning: Case data directory not found: {self.case_data}")
            return []

        evidence_files = []

        # Scan for priority file types
        for pattern in ['*.pdf', '*.xlsx', '*.csv', '*.jpg', '*.jpeg', '*.png']:
            for file_path in Path(self.case_data).rglob(pattern):
                if file_path.is_file():
                    evidence_files.append(str(file_path))

        return evidence_files

    def status(self):
        """Show ChittyOS evidence status"""
        print("🔍 ChittyOS Evidence Status")
        print("=" * 50)

        # Directory status
        print(f"ChittyOS Data: {self.chittyos_data}")
        print(f"Case Data: {self.case_data}")
        print(f"Metadata Dir: {self.metadata_dir}")
        print(f"Vault Dir: {self.vault_dir}")
        print()

        # Evidence counts
        evidence_list = self.list_evidence()
        total_evidence = len(evidence_list)

        by_type = {}
        by_priority = {}
        by_status = {}

        for evidence in evidence_list:
            ev_type = evidence.get('evidence_type', 'unknown')
            priority = evidence.get('priority', 'unknown')
            status = evidence.get('status', 'unknown')

            by_type[ev_type] = by_type.get(ev_type, 0) + 1
            by_priority[priority] = by_priority.get(priority, 0) + 1
            by_status[status] = by_status.get(status, 0) + 1

        print(f"📊 Total Evidence Items: {total_evidence}")
        print()

        print("📁 By Type:")
        for ev_type, count in sorted(by_type.items()):
            print(f"  {ev_type}: {count}")
        print()

        print("⚡ By Priority:")
        for priority, count in sorted(by_priority.items()):
            print(f"  {priority}: {count}")
        print()

        print("🔄 By Status:")
        for status, count in sorted(by_status.items()):
            print(f"  {status}: {count}")

    def scan(self):
        """Scan for new evidence in case directory"""
        print("🔍 Scanning for new evidence...")

        new_files = self.scan_case_directory()
        existing_metadata = {ev['file_path'] for ev in self.list_evidence()}

        new_evidence = [f for f in new_files if f not in existing_metadata]

        print(f"📁 Found {len(new_files)} total files")
        print(f"🆕 Found {len(new_evidence)} new evidence items")

        if new_evidence:
            print("\n🎯 New evidence (first 10):")
            for i, file_path in enumerate(new_evidence[:10]):
                filename = os.path.basename(file_path)
                print(f"  {i+1}. {filename}")

        return new_evidence

def main():
    parser = argparse.ArgumentParser(description='ChittyOS Evidence CLI')
    parser.add_argument('action', choices=['status', 'scan', 'list'],
                       help='Action to perform')
    parser.add_argument('--case', help='Filter by case ID')

    args = parser.parse_args()

    try:
        cli = ChittyOSEvidenceCLI()

        if args.action == 'status':
            cli.status()
        elif args.action == 'scan':
            cli.scan()
        elif args.action == 'list':
            evidence_list = cli.list_evidence(args.case)
            for evidence in evidence_list:
                print(f"{evidence['filename']} ({evidence['evidence_type']}) - {evidence['priority']} priority")

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()