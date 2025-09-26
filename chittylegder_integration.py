#!/usr/bin/env python3

"""
ChittyLedger Integration for Evidence Management
Bridges ChittyOS-Data with ChittyLedger Notion database
"""

import os
import json
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any
import logging
import aiohttp
from notion_client import AsyncClient
from evidence_analyzer_chittyos import ChittyOSEvidenceAnalyzer

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ChittyLedgerBridge:
    """
    Bridges ChittyOS-Data storage with ChittyLedger Notion database
    Implements the Evidence ID ↔ File Hash mapping system
    """

    def __init__(self, case_id: str, notion_token: str = None, database_id: str = None):
        self.case_id = case_id
        self.notion = AsyncClient(auth=notion_token or os.getenv("NOTION_TOKEN"))
        self.database_id = database_id or os.getenv("CHITTYLEGDER_DATABASE_ID")

        # Initialize ChittyOS analyzer
        self.analyzer = ChittyOSEvidenceAnalyzer(case_id)

    async def mint_evidence(self, file_hash: str, chitty_id: str, metadata: Dict[str, Any]) -> str:
        """
        Mint evidence entry in ChittyLedger with ChittyOS-Data file hash mapping

        Returns:
            str: ChittyLedger Evidence ID
        """

        # Create ChittyLedger database entry
        evidence_properties = {
            "Evidence ID": {
                "title": [{"text": {"content": chitty_id}}]
            },
            "File Hash": {
                "rich_text": [{"text": {"content": file_hash}}]
            },
            "Case ID": {
                "select": {"name": self.case_id}
            },
            "Chain Status": {
                "select": {"name": "Minted"}
            },
            "File Type": {
                "select": {"name": metadata.get("file_type", "Unknown")}
            },
            "File Size": {
                "number": metadata.get("file_size", 0)
            },
            "Mint Timestamp": {
                "date": {"start": datetime.now(timezone.utc).isoformat()}
            },
            "ChittyOS Path": {
                "url": metadata.get("archived_path", "")
            },
            "AI Confidence": {
                "number": metadata.get("ai_confidence", 0.95)
            },
            "Evidence Type": {
                "select": {"name": self._classify_evidence_type(metadata)}
            },
            "Verification Status": {
                "select": {"name": "Verified"}
            }
        }

        # Add business entity separation if available
        if "business_entity" in metadata:
            evidence_properties["Business Entity"] = {
                "select": {"name": metadata["business_entity"]}
            }

        try:
            response = await self.notion.pages.create(
                parent={"database_id": self.database_id},
                properties=evidence_properties
            )

            evidence_id = response["id"]
            logger.info(f"Minted evidence in ChittyLedger: {evidence_id} → {file_hash}")

            # Update local mapping
            await self._store_mapping(evidence_id, chitty_id, file_hash)

            return evidence_id

        except Exception as e:
            logger.error(f"Failed to mint evidence: {e}")
            raise

    async def update_chain_status(self, evidence_id: str, status: str, verification_data: Dict = None):
        """
        Update chain status in ChittyLedger

        Args:
            evidence_id: ChittyLedger Evidence ID
            status: One of 'Pending', 'Minted', 'Rejected'
            verification_data: Additional verification metadata
        """

        update_properties = {
            "Chain Status": {"select": {"name": status}},
            "Last Updated": {"date": {"start": datetime.now(timezone.utc).isoformat()}}
        }

        if verification_data:
            if "ai_confidence" in verification_data:
                update_properties["AI Confidence"] = {"number": verification_data["ai_confidence"]}
            if "verification_notes" in verification_data:
                update_properties["Notes"] = {
                    "rich_text": [{"text": {"content": verification_data["verification_notes"]}}]
                }

        try:
            await self.notion.pages.update(
                page_id=evidence_id,
                properties=update_properties
            )
            logger.info(f"Updated chain status for {evidence_id}: {status}")
        except Exception as e:
            logger.error(f"Failed to update chain status: {e}")
            raise

    async def process_ai_metadata(self, file_hash: str) -> Dict[str, Any]:
        """
        Process file through AI pipeline and return enhanced metadata
        """

        # Get ChittyOS metadata
        metadata_file = self.analyzer.chittyos_metadata_dir / f"{file_hash[:16]}.json"

        if not metadata_file.exists():
            logger.warning(f"No metadata found for hash {file_hash}")
            return {}

        with open(metadata_file, 'r') as f:
            base_metadata = json.load(f)

        # Enhance with AI analysis
        file_path = Path(base_metadata["archived_path"])

        if file_path.exists():
            ai_metadata = await self._analyze_with_ai(file_path)
            base_metadata.update(ai_metadata)

        return base_metadata

    async def _analyze_with_ai(self, file_path: Path) -> Dict[str, Any]:
        """Run AI analysis on file content"""

        # This would integrate with your AI processing pipeline
        # For now, return mock enhanced metadata

        return {
            "ai_confidence": 0.95,
            "content_type": "legal_document",
            "relevance_score": 0.85,
            "entity_mentions": ["Vanguard", "Rob", "TRO"],
            "date_extracted": datetime.now(timezone.utc).isoformat(),
            "processing_version": "1.0"
        }

    def _classify_evidence_type(self, metadata: Dict[str, Any]) -> str:
        """Classify evidence based on metadata"""

        file_type = metadata.get("file_type", "").upper()
        file_name = metadata.get("file_name", "").lower()

        if file_type == "PDF":
            if "email" in file_name or "message" in file_name:
                return "Email/Message"
            elif "contract" in file_name or "agreement" in file_name:
                return "Contract"
            elif "court" in file_name or "motion" in file_name or "tro" in file_name:
                return "Court Document"
            else:
                return "Document"
        elif file_type in ["PNG", "JPG", "JPEG"]:
            return "Screenshot/Image"
        elif file_type in ["CSV", "JSON", "XML"]:
            return "Data Export"
        else:
            return "Other"

    async def _store_mapping(self, evidence_id: str, chitty_id: str, file_hash: str):
        """Store Evidence ID → File Hash mapping locally"""

        mapping_file = self.analyzer.chittyos_metadata_dir / "evidence_mappings.json"

        if mapping_file.exists():
            with open(mapping_file, 'r') as f:
                mappings = json.load(f)
        else:
            mappings = {}

        mappings[evidence_id] = {
            "chitty_id": chitty_id,
            "file_hash": file_hash,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        with open(mapping_file, 'w') as f:
            json.dump(mappings, f, indent=2)

    async def sync_pending_evidence(self):
        """
        Sync any evidence that's in ChittyOS-Data but not yet in ChittyLedger
        """

        logger.info("Syncing pending evidence to ChittyLedger...")

        # Get all files in flat_output
        flat_files = list(self.analyzer.chittyos_flat_output.glob("*"))

        # Load existing mappings
        mapping_file = self.analyzer.chittyos_metadata_dir / "evidence_mappings.json"
        existing_mappings = {}
        if mapping_file.exists():
            with open(mapping_file, 'r') as f:
                existing_mappings = json.load(f)

        synced_count = 0

        for file_path in flat_files:
            if file_path.is_file():
                # Extract file hash from filename
                file_hash = file_path.name.split('_')[0]

                # Check if already synced
                already_synced = any(
                    mapping["file_hash"] == file_hash
                    for mapping in existing_mappings.values()
                )

                if not already_synced:
                    # Process and mint
                    metadata = await self.process_ai_metadata(file_hash)

                    if metadata:
                        chitty_id = metadata.get("chitty_id")
                        if chitty_id:
                            await self.mint_evidence(file_hash, chitty_id, metadata)
                            synced_count += 1

        logger.info(f"Synced {synced_count} new evidence entries to ChittyLedger")
        return synced_count

    async def generate_chain_of_custody_report(self) -> Dict[str, Any]:
        """
        Generate comprehensive chain of custody report
        """

        # Query ChittyLedger database for all evidence
        try:
            response = await self.notion.databases.query(
                database_id=self.database_id,
                filter={
                    "property": "Case ID",
                    "select": {"equals": self.case_id}
                }
            )

            custody_entries = []

            for page in response["results"]:
                props = page["properties"]

                entry = {
                    "evidence_id": page["id"],
                    "chitty_id": self._extract_notion_text(props.get("Evidence ID", {})),
                    "file_hash": self._extract_notion_text(props.get("File Hash", {})),
                    "chain_status": self._extract_notion_select(props.get("Chain Status", {})),
                    "verification_status": self._extract_notion_select(props.get("Verification Status", {})),
                    "mint_timestamp": self._extract_notion_date(props.get("Mint Timestamp", {})),
                    "ai_confidence": self._extract_notion_number(props.get("AI Confidence", {})),
                    "evidence_type": self._extract_notion_select(props.get("Evidence Type", {}))
                }

                custody_entries.append(entry)

            report = {
                "case_id": self.case_id,
                "report_timestamp": datetime.now(timezone.utc).isoformat(),
                "total_evidence": len(custody_entries),
                "minted_evidence": len([e for e in custody_entries if e["chain_status"] == "Minted"]),
                "pending_evidence": len([e for e in custody_entries if e["chain_status"] == "Pending"]),
                "rejected_evidence": len([e for e in custody_entries if e["chain_status"] == "Rejected"]),
                "custody_chain": custody_entries
            }

            # Save report
            report_file = self.analyzer.chittyos_output_dir / "chain_of_custody.json"
            with open(report_file, 'w') as f:
                json.dump(report, f, indent=2)

            logger.info(f"Chain of custody report generated: {report_file}")
            return report

        except Exception as e:
            logger.error(f"Failed to generate custody report: {e}")
            raise

    def _extract_notion_text(self, prop: Dict) -> str:
        """Extract text from Notion property"""
        if prop.get("title"):
            return prop["title"][0]["text"]["content"] if prop["title"] else ""
        elif prop.get("rich_text"):
            return prop["rich_text"][0]["text"]["content"] if prop["rich_text"] else ""
        return ""

    def _extract_notion_select(self, prop: Dict) -> str:
        """Extract select value from Notion property"""
        return prop.get("select", {}).get("name", "") if prop.get("select") else ""

    def _extract_notion_date(self, prop: Dict) -> str:
        """Extract date from Notion property"""
        return prop.get("date", {}).get("start", "") if prop.get("date") else ""

    def _extract_notion_number(self, prop: Dict) -> float:
        """Extract number from Notion property"""
        return prop.get("number", 0) if prop.get("number") is not None else 0


async def main():
    """Example usage of ChittyLedger integration"""

    case_id = "2024D007847"

    # Initialize bridge
    bridge = ChittyLedgerBridge(case_id)

    # Sync any pending evidence
    await bridge.sync_pending_evidence()

    # Generate chain of custody report
    report = await bridge.generate_chain_of_custody_report()

    print(f"Chain of Custody Report for {case_id}:")
    print(f"Total Evidence: {report['total_evidence']}")
    print(f"Minted: {report['minted_evidence']}")
    print(f"Pending: {report['pending_evidence']}")

if __name__ == "__main__":
    asyncio.run(main())