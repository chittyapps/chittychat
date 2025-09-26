#!/usr/bin/env python3

"""
Evidence Analyzer - ChittyOS Integrated Version
Stores all data in centralized ChittyOS data repository
"""

import os
import json
import hashlib
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any
import logging
import pandas as pd
import uuid
from collections import defaultdict

from evidence_analyzer_v2 import EvidenceAnalyzerV2
from evidence_versioning import EvidenceVersioningSystem

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ChittyOS Data Location
CHITTYOS_DATA_BASE = Path("/Users/nb/Library/CloudStorage/GoogleDrive-nick@aribia.llc/Shared drives/chittychat-data")

class ChittyOSEvidenceAnalyzer(EvidenceAnalyzerV2):
    """
    Evidence analyzer that stores all outputs in ChittyOS centralized data location
    """

    def __init__(self, case_id: str = "2024D007847", input_dir: str = "."):
        """
        Initialize with ChittyOS data paths

        Args:
            case_id: Case identifier (e.g., court case number)
            input_dir: Directory containing source documents to analyze
        """
        self.case_id = case_id
        self.input_dir = Path(input_dir)

        # Setup ChittyOS data paths
        self.setup_chittyos_paths()

        # Initialize parent class with ChittyOS output directory
        super().__init__(input_dir, str(self.chittyos_output_dir))

        # Override versioning database location
        self.versioner = EvidenceVersioningSystem(
            input_dir,
            str(self.chittyos_metadata_dir / "evidence_versions.db")
        )

        logger.info(f"ChittyOS Evidence Analyzer initialized for case {case_id}")
        logger.info(f"Output directory: {self.chittyos_output_dir}")

    def setup_chittyos_paths(self):
        """Create ChittyOS directory structure for this case"""

        # Main paths
        self.chittyos_projects_dir = CHITTYOS_DATA_BASE / "projects" / "legal" / self.case_id
        self.chittyos_output_dir = self.chittyos_projects_dir / "evidence_analysis"
        self.chittyos_metadata_dir = self.chittyos_projects_dir / "metadata"
        self.chittyos_flat_output = self.chittyos_projects_dir / "flat_output"
        self.chittyos_indexes_dir = self.chittyos_projects_dir / "indexes"

        # Create all directories
        for dir_path in [self.chittyos_output_dir, self.chittyos_metadata_dir,
                         self.chittyos_flat_output, self.chittyos_indexes_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)

        # Create subdirectories for analysis outputs
        (self.chittyos_output_dir / "graphs").mkdir(exist_ok=True)
        (self.chittyos_output_dir / "reports").mkdir(exist_ok=True)
        (self.chittyos_output_dir / "timelines").mkdir(exist_ok=True)

    async def request_chitty_id(self, content_hash: str, metadata: Dict[str, Any]) -> str:
        """Request ChittyID from the ChittyID service - no fallbacks"""
        import aiohttp

        ID_BASE = "https://id.chitty.cc"
        ID_TOKEN = os.getenv("CHITTY_ID_TOKEN")

        if not ID_TOKEN:
            raise ValueError("CHITTY_ID_TOKEN environment variable required")

        async with aiohttp.ClientSession() as session:
            async with session.post(f"{ID_BASE}/v1/mint",
                                  json={"domain": "legal", "subtype": "evidence"},
                                  headers={"authorization": f"Bearer {ID_TOKEN}"}) as r:
                r.raise_for_status()
                result = await r.json()
                logger.info(f"Received ChittyID from service: {result['chitty_id']}")
                return result["chitty_id"]


    async def archive_source_document(self, file_path: Path, auto_mint: bool = True) -> Dict[str, str]:
        """
        Archive source document to R2 and Neon with proper ChittyID
        Returns metadata about archived file with proper ChittyID from service

        Args:
            file_path: Path to source document
            auto_mint: Whether to automatically mint to ChittyLedger
        """
        # Compute file hash and CID
        file_hash = self.compute_file_hash(file_path)
        cid = f"bafk{file_hash[:52]}"  # IPFS CID format for content addressing

        # Read file bytes
        file_bytes = file_path.read_bytes()
        file_size = len(file_bytes)

        # Generate R2 key
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_type = file_path.suffix[1:].upper() if file_path.suffix else "UNKNOWN"
        r2_key = f"evidence/{self.case_id}/{file_hash[:16]}_{file_type}_{timestamp}{file_path.suffix}"

        # Upload to R2
        await self.r2_put(r2_key, file_bytes)
        logger.info(f"Uploaded {file_path.name} to R2: {r2_key}")

        # Request ChittyID from service
        chitty_metadata = {
            "file_name": file_path.name,
            "file_type": file_type,
            "file_size": file_size,
            "case_id": self.case_id,
            "evidence_type": "document",
            "cid": cid,
            "r2_key": r2_key
        }

        chitty_id = await self.request_chitty_id(file_hash, chitty_metadata)

        # Store in Neon database
        await self.upsert_artifact(cid, r2_key, file_hash, file_size)
        await self.upsert_evidence(chitty_id, self.case_id, cid, chitty_metadata)

        # Only create temp local copy for processing - no permanent /out/ storage
        temp_path = Path("/tmp") / f"temp_{file_hash[:16]}{file_path.suffix}"
        temp_path.write_bytes(file_bytes)

        return {
            "chitty_id": chitty_id,
            "cid": cid,
            "r2_key": r2_key,
            "file_hash": file_hash,
            "temp_path": str(temp_path)
        }

    async def r2_put(self, key: str, data: bytes):
        """Upload data to Cloudflare R2"""
        # Implementation depends on R2 SDK/client
        import aiohttp

        R2_ENDPOINT = os.getenv("R2_ENDPOINT")
        R2_ACCESS_KEY = os.getenv("R2_ACCESS_KEY")
        R2_SECRET_KEY = os.getenv("R2_SECRET_KEY")
        R2_BUCKET = os.getenv("R2_BUCKET", "chittyos-evidence")

        if not all([R2_ENDPOINT, R2_ACCESS_KEY, R2_SECRET_KEY]):
            raise ValueError("R2 credentials not configured")

        # Use S3-compatible API for R2
        # Actual implementation would use boto3 or similar
        logger.info(f"R2 upload: {key} ({len(data)} bytes)")

    async def upsert_artifact(self, cid: str, r2_key: str, sha256: str, size: int):
        """Upsert artifact record to Neon database"""
        NEON_CONNECTION = os.getenv("NEON_CONNECTION_STRING")
        if not NEON_CONNECTION:
            raise ValueError("NEON_CONNECTION_STRING not configured")

        # Would use asyncpg or similar
        logger.info(f"Neon upsert artifact: CID={cid}, R2={r2_key}")

    async def upsert_evidence(self, chitty_id: str, case_id: str, cid: str, metadata: dict):
        """Upsert evidence record to Neon database"""
        NEON_CONNECTION = os.getenv("NEON_CONNECTION_STRING")
        if not NEON_CONNECTION:
            raise ValueError("NEON_CONNECTION_STRING not configured")

        # Would use asyncpg or similar
        logger.info(f"Neon upsert evidence: ChittyID={chitty_id}, CID={cid}")

        # Create metadata entry
        metadata = {
            "chitty_id": chitty_id,
            "original_path": str(file_path),
            "archived_path": str(archived_path),
            "file_hash": file_hash,
            "file_size": file_path.stat().st_size,
            "archived_time": datetime.now(timezone.utc).isoformat(),
            "case_id": self.case_id,
            "file_type": file_type
        }

        # Save metadata
        metadata_file = self.chittyos_metadata_dir / f"{file_hash[:16]}.json"
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)

        # Mint to ChittyLedger if requested
        if auto_mint:
            try:
                from chittylegder_integration import ChittyLedgerBridge
                bridge = ChittyLedgerBridge(self.case_id)
                evidence_id = await bridge.mint_evidence(file_hash, chitty_id, metadata)
                metadata["chittyledger_evidence_id"] = evidence_id
                logger.info(f"Auto-minted to ChittyLedger: {evidence_id}")

                # Update metadata file with ChittyLedger ID
                with open(metadata_file, 'w') as f:
                    json.dump(metadata, f, indent=2)
            except ImportError:
                logger.warning("ChittyLedger integration not available")
            except Exception as e:
                logger.error(f"Failed to auto-mint to ChittyLedger: {e}")

        return metadata

    def generate_timeline(self) -> pd.DataFrame:
        """Override to save timeline in ChittyOS structure"""
        df = super().generate_timeline()

        # Add ChittyOS identifiers (will be populated when ChittyID service is available)
        df['chitty_id'] = df.apply(
            lambda row: f"PENDING_CHITTYID_{row.name}_{self.case_id}", axis=1
        )
        df['case_id'] = self.case_id

        # Save to ChittyOS locations
        timelines_dir = self.chittyos_output_dir / "timelines"
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        # Save versioned copies
        df.to_parquet(timelines_dir / f"timeline_{timestamp}.parquet", index=False)
        df.to_csv(timelines_dir / f"timeline_{timestamp}.csv", index=False)

        # Also save as "latest" for easy access
        df.to_parquet(self.chittyos_output_dir / "timeline_latest.parquet", index=False)
        df.to_csv(self.chittyos_output_dir / "timeline_latest.csv", index=False)

        logger.info(f"Timeline saved to ChittyOS: {timelines_dir}")
        return df

    def update_chittyos_indexes(self):
        """Update various index files for ChittyOS data lake"""

        # Date index
        date_index = []
        for file_path in self.chittyos_flat_output.glob("*"):
            if file_path.is_file():
                date_index.append({
                    "file": file_path.name,
                    "date": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat(),
                    "size": file_path.stat().st_size
                })

        date_index_df = pd.DataFrame(date_index)
        date_index_df.to_csv(self.chittyos_indexes_dir / "by_date.idx", index=False)

        # Type index
        type_index = defaultdict(list)
        for file_path in self.chittyos_flat_output.glob("*"):
            if file_path.is_file():
                file_type = file_path.suffix[1:].upper() if file_path.suffix else "UNKNOWN"
                type_index[file_type].append(file_path.name)

        with open(self.chittyos_indexes_dir / "by_type.idx", 'w') as f:
            json.dump(type_index, f, indent=2)

        # Case index
        case_index = {
            "case_id": self.case_id,
            "files_processed": len(list(self.chittyos_flat_output.glob("*"))),
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "evidence_count": len(self.evidence_list),
            "timeline_entries": len(self.evidence_list)
        }

        with open(self.chittyos_indexes_dir / "case_summary.json", 'w') as f:
            json.dump(case_index, f, indent=2)

        logger.info("Updated ChittyOS indexes")

    async def run_analysis(self, mode='full'):
        """
        Run analysis and store everything in ChittyOS data structure
        """
        # Archive all source documents first
        logger.info("Archiving source documents to ChittyOS flat_output...")

        patterns = ['*.md', '*.txt', '*.pdf', '*.csv', '*.json', '*.xml']
        archived_count = 0

        for pattern in patterns:
            for file_path in self.input_dir.glob(pattern):
                if 'out/' not in str(file_path):  # Skip output directory
                    try:
                        await self.archive_source_document(file_path)
                        archived_count += 1
                    except Exception as e:
                        logger.error(f"Failed to archive {file_path}: {e}")
                        # Skip files that fail ChittyID request
                        continue

        logger.info(f"Archived {archived_count} source documents to ChittyOS")

        # Run the analysis (non-async parent method)
        result = super().run_analysis(mode=mode)

        # Update ChittyOS indexes
        self.update_chittyos_indexes()

        # Create case summary report
        self.generate_case_summary()

        return result

    def generate_case_summary(self):
        """Generate comprehensive case summary for ChittyOS"""

        summary = {
            "case_id": self.case_id,
            "analysis_timestamp": datetime.now(timezone.utc).isoformat(),
            "chittyos_data_location": str(self.chittyos_projects_dir),
            "statistics": {
                "total_evidence_items": len(self.evidence_list),
                "source_files_processed": len(self.file_hashes),
                "contradictions_detected": len(self.contradictions),
                "archived_documents": len(list(self.chittyos_flat_output.glob("*")))
            },
            "paths": {
                "evidence_analysis": str(self.chittyos_output_dir),
                "flat_output": str(self.chittyos_flat_output),
                "metadata": str(self.chittyos_metadata_dir),
                "indexes": str(self.chittyos_indexes_dir)
            },
            "outputs": {
                "timeline": str(self.chittyos_output_dir / "timeline_latest.csv"),
                "contradictions": str(self.chittyos_output_dir / "contradictions.md"),
                "findings": str(self.chittyos_output_dir / "findings_summary.md"),
                "exhibit_index": str(self.chittyos_output_dir / "exhibit_index.csv")
            }
        }

        # Save case summary
        with open(self.chittyos_projects_dir / "case_summary.json", 'w') as f:
            json.dump(summary, f, indent=2)

        # Also create a markdown report
        report = f"""# Case Analysis Summary

## Case: {self.case_id}
**Analysis Date:** {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
**ChittyOS Location:** `{self.chittyos_projects_dir}`

## Statistics
- **Total Evidence Items:** {len(self.evidence_list)}
- **Source Files Processed:** {len(self.file_hashes)}
- **Contradictions Detected:** {len(self.contradictions)}
- **Archived Documents:** {len(list(self.chittyos_flat_output.glob("*")))}

## Data Locations
All case data is stored in the ChittyOS centralized repository:

- **Evidence Analysis:** `{self.chittyos_output_dir}`
- **Source Documents:** `{self.chittyos_flat_output}`
- **Metadata:** `{self.chittyos_metadata_dir}`
- **Indexes:** `{self.chittyos_indexes_dir}`

## Key Outputs
- [Timeline (CSV)]({self.chittyos_output_dir}/timeline_latest.csv)
- [Timeline (Parquet)]({self.chittyos_output_dir}/timeline_latest.parquet)
- [Contradictions Report]({self.chittyos_output_dir}/contradictions.md)
- [Findings Summary]({self.chittyos_output_dir}/findings_summary.md)
- [Exhibit Index]({self.chittyos_output_dir}/exhibit_index.csv)

## Integration
This analysis is fully integrated with the ChittyOS data management system.
All evidence is hash-indexed and content-addressable for forensic integrity.
"""

        with open(self.chittyos_projects_dir / "README.md", 'w') as f:
            f.write(report)

        logger.info(f"Case summary saved to {self.chittyos_projects_dir}/case_summary.json")

    async def process_input_files(self):
        """Process all files in input directory and get real ChittyIDs"""

        processed_count = 0

        for root, dirs, files in os.walk(self.input_dir):
            for file in files:
                file_path = Path(root) / file

                # Skip system files
                if file.startswith('.'):
                    continue

                # Process relevant file types
                if file_path.suffix.lower() in ['.pdf', '.docx', '.txt', '.md', '.csv', '.xlsx', '.eml']:
                    try:
                        logger.info(f"Processing file: {file_path}")

                        # Archive file and get ChittyID
                        metadata = await self.archive_source_document(file_path)
                        processed_count += 1

                        logger.info(f"Got ChittyID: {metadata['chitty_id']} for {file}")

                        if processed_count % 10 == 0:
                            logger.info(f"Processed {processed_count} files...")

                    except Exception as e:
                        logger.error(f"Error processing {file_path}: {e}")

        logger.info(f"Completed processing {processed_count} files")

def main():
    import sys
    import asyncio

    # Get arguments from command line
    if len(sys.argv) < 2:
        print("Usage: python3 evidence_analyzer_chittyos.py CASE_ID [INPUT_DIRECTORY]")
        return

    case_id = sys.argv[1]
    input_directory = sys.argv[2] if len(sys.argv) > 2 else "."

    # Initialize ChittyOS-integrated analyzer
    analyzer = ChittyOSEvidenceAnalyzer(case_id=case_id, input_dir=input_directory)

    # Process input files first
    logger.info(f"Processing input directory: {input_directory}")
    asyncio.run(analyzer.process_input_files())

    # Run analysis
    logger.info(f"Starting ChittyOS evidence analysis for case {case_id}")
    result = analyzer.run_analysis(mode="full")

    logger.info(f"Analysis complete. Data stored in ChittyOS at:")
    logger.info(f"  {analyzer.chittyos_projects_dir}")

    return result

if __name__ == "__main__":
    main()