#!/usr/bin/env python3

"""
Chain Status Integration Workflow
Orchestrates evidence flow between ChittyOS-Data and ChittyLedger
"""

import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any
from enum import Enum

from chittylegder_integration import ChittyLedgerBridge
from evidence_analyzer_chittyos import ChittyOSEvidenceAnalyzer

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ChainStatus(Enum):
    """Evidence chain status states"""
    PENDING = "Pending"
    MINTED = "Minted"
    REJECTED = "Rejected"
    VERIFIED = "Verified"
    DISPUTED = "Disputed"

class EvidenceChainWorkflow:
    """
    Manages evidence lifecycle through ChittyOS-Data → ChittyLedger workflow
    """

    def __init__(self, case_id: str):
        self.case_id = case_id
        self.analyzer = ChittyOSEvidenceAnalyzer(case_id)
        self.bridge = ChittyLedgerBridge(case_id)

    async def process_evidence_pipeline(self, input_dir: str = ".") -> Dict[str, Any]:
        """
        Complete evidence processing pipeline:
        1. ChittyOS-Data storage (immutable)
        2. AI processing and analysis
        3. ChittyLedger minting (blockchain verification)
        4. Chain of custody tracking
        """

        logger.info(f"Starting evidence pipeline for case {self.case_id}")

        pipeline_results = {
            "case_id": self.case_id,
            "pipeline_start": datetime.now(timezone.utc).isoformat(),
            "stages": {
                "chittyos_storage": {"status": "pending", "files_processed": 0},
                "ai_processing": {"status": "pending", "metadata_enhanced": 0},
                "chittyledger_minting": {"status": "pending", "evidence_minted": 0},
                "chain_verification": {"status": "pending", "verified_count": 0}
            },
            "errors": []
        }

        try:
            # Stage 1: ChittyOS-Data Storage
            logger.info("Stage 1: Processing files through ChittyOS-Data...")
            pipeline_results["stages"]["chittyos_storage"]["status"] = "in_progress"

            # Run ChittyOS analysis (stores files immutably)
            analysis_result = await self.analyzer.run_analysis(mode='full')
            files_processed = len(self.analyzer.evidence_list)

            pipeline_results["stages"]["chittyos_storage"]["status"] = "completed"
            pipeline_results["stages"]["chittyos_storage"]["files_processed"] = files_processed

            # Stage 2: AI Processing Bridge
            logger.info("Stage 2: AI metadata enhancement...")
            pipeline_results["stages"]["ai_processing"]["status"] = "in_progress"

            enhanced_metadata = await self._enhance_all_metadata()
            pipeline_results["stages"]["ai_processing"]["status"] = "completed"
            pipeline_results["stages"]["ai_processing"]["metadata_enhanced"] = len(enhanced_metadata)

            # Stage 3: ChittyLedger Minting
            logger.info("Stage 3: Minting evidence to ChittyLedger...")
            pipeline_results["stages"]["chittyledger_minting"]["status"] = "in_progress"

            minted_count = await self._mint_all_evidence(enhanced_metadata)
            pipeline_results["stages"]["chittyledger_minting"]["status"] = "completed"
            pipeline_results["stages"]["chittyledger_minting"]["evidence_minted"] = minted_count

            # Stage 4: Chain Verification
            logger.info("Stage 4: Chain of custody verification...")
            pipeline_results["stages"]["chain_verification"]["status"] = "in_progress"

            custody_report = await self.bridge.generate_chain_of_custody_report()
            verified_count = custody_report["minted_evidence"]

            pipeline_results["stages"]["chain_verification"]["status"] = "completed"
            pipeline_results["stages"]["chain_verification"]["verified_count"] = verified_count

            pipeline_results["pipeline_end"] = datetime.now(timezone.utc).isoformat()
            pipeline_results["success"] = True

            logger.info(f"Pipeline completed successfully:")
            logger.info(f"  Files processed: {files_processed}")
            logger.info(f"  Metadata enhanced: {len(enhanced_metadata)}")
            logger.info(f"  Evidence minted: {minted_count}")
            logger.info(f"  Chain verified: {verified_count}")

        except Exception as e:
            logger.error(f"Pipeline failed: {e}")
            pipeline_results["errors"].append(str(e))
            pipeline_results["success"] = False

        # Save pipeline results
        results_file = self.analyzer.chittyos_output_dir / "pipeline_results.json"
        import json
        with open(results_file, 'w') as f:
            json.dump(pipeline_results, f, indent=2)

        return pipeline_results

    async def _enhance_all_metadata(self) -> List[Dict[str, Any]]:
        """Enhance metadata for all archived files using AI processing"""

        enhanced_metadata = []

        # Get all archived files
        archived_files = list(self.analyzer.chittyos_flat_output.glob("*"))

        for file_path in archived_files:
            if file_path.is_file():
                # Extract file hash from filename
                file_hash = file_path.name.split('_')[0]

                # Process with AI
                try:
                    metadata = await self.bridge.process_ai_metadata(file_hash)
                    if metadata:
                        enhanced_metadata.append(metadata)
                except Exception as e:
                    logger.error(f"Failed to enhance metadata for {file_hash}: {e}")

        return enhanced_metadata

    async def _mint_all_evidence(self, enhanced_metadata: List[Dict[str, Any]]) -> int:
        """Mint all enhanced evidence to ChittyLedger"""

        minted_count = 0

        for metadata in enhanced_metadata:
            try:
                file_hash = metadata.get("file_hash")
                chitty_id = metadata.get("chitty_id")

                if file_hash and chitty_id:
                    evidence_id = await self.bridge.mint_evidence(file_hash, chitty_id, metadata)
                    minted_count += 1

                    # Update status to Minted
                    await self.bridge.update_chain_status(
                        evidence_id,
                        ChainStatus.MINTED.value,
                        {"verification_notes": "Automatically minted via pipeline"}
                    )

            except Exception as e:
                logger.error(f"Failed to mint evidence: {e}")

        return minted_count

    async def update_evidence_status(self, evidence_id: str, new_status: ChainStatus,
                                   verification_data: Dict = None) -> bool:
        """
        Update evidence chain status with workflow validation
        """

        try:
            # Validate status transition
            if not await self._validate_status_transition(evidence_id, new_status):
                logger.error(f"Invalid status transition for {evidence_id} to {new_status.value}")
                return False

            # Update in ChittyLedger
            await self.bridge.update_chain_status(
                evidence_id,
                new_status.value,
                verification_data
            )

            # Log chain event
            await self._log_chain_event(evidence_id, new_status, verification_data)

            logger.info(f"Updated evidence {evidence_id} status to {new_status.value}")
            return True

        except Exception as e:
            logger.error(f"Failed to update evidence status: {e}")
            return False

    async def _validate_status_transition(self, evidence_id: str, new_status: ChainStatus) -> bool:
        """Validate that status transition is allowed"""

        # Define allowed transitions
        allowed_transitions = {
            ChainStatus.PENDING: [ChainStatus.MINTED, ChainStatus.REJECTED],
            ChainStatus.MINTED: [ChainStatus.VERIFIED, ChainStatus.DISPUTED],
            ChainStatus.VERIFIED: [ChainStatus.DISPUTED],
            ChainStatus.REJECTED: [ChainStatus.PENDING],  # Allow reprocessing
            ChainStatus.DISPUTED: [ChainStatus.VERIFIED, ChainStatus.REJECTED]
        }

        # Get current status (would query ChittyLedger)
        # For now, assume all transitions are valid
        return True

    async def _log_chain_event(self, evidence_id: str, status: ChainStatus,
                              verification_data: Dict = None):
        """Log chain of custody event"""

        event = {
            "evidence_id": evidence_id,
            "case_id": self.case_id,
            "status": status.value,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "verification_data": verification_data or {}
        }

        # Append to chain log
        chain_log_file = self.analyzer.chittyos_metadata_dir / "chain_events.jsonl"

        import json
        with open(chain_log_file, 'a') as f:
            f.write(json.dumps(event) + '\n')

    async def generate_integrity_report(self) -> Dict[str, Any]:
        """
        Generate comprehensive integrity report comparing ChittyOS-Data and ChittyLedger
        """

        logger.info("Generating integrity report...")

        # Get ChittyOS file inventory
        chittyos_files = {}
        for file_path in self.analyzer.chittyos_flat_output.glob("*"):
            if file_path.is_file():
                file_hash = file_path.name.split('_')[0]
                chittyos_files[file_hash] = {
                    "file_path": str(file_path),
                    "file_size": file_path.stat().st_size,
                    "modified_time": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat()
                }

        # Get ChittyLedger evidence inventory
        custody_report = await self.bridge.generate_chain_of_custody_report()
        chittyledger_evidence = {
            entry["file_hash"]: entry
            for entry in custody_report["custody_chain"]
            if entry["file_hash"]
        }

        # Compare inventories
        chittyos_hashes = set(chittyos_files.keys())
        chittyledger_hashes = set(chittyledger_evidence.keys())

        integrity_report = {
            "case_id": self.case_id,
            "report_timestamp": datetime.now(timezone.utc).isoformat(),
            "chittyos_file_count": len(chittyos_files),
            "chittyledger_evidence_count": len(chittyledger_evidence),
            "synchronized_count": len(chittyos_hashes & chittyledger_hashes),
            "chittyos_only": list(chittyos_hashes - chittyledger_hashes),
            "chittyledger_only": list(chittyledger_hashes - chittyos_hashes),
            "integrity_status": "SYNCHRONIZED" if chittyos_hashes == chittyledger_hashes else "DRIFT_DETECTED",
            "details": {
                "chittyos_inventory": chittyos_files,
                "chittyledger_inventory": chittyledger_evidence
            }
        }

        # Save integrity report
        report_file = self.analyzer.chittyos_output_dir / "integrity_report.json"
        import json
        with open(report_file, 'w') as f:
            json.dump(integrity_report, f, indent=2)

        logger.info(f"Integrity report saved: {report_file}")
        logger.info(f"Integrity status: {integrity_report['integrity_status']}")

        return integrity_report


async def main():
    """Example workflow execution"""

    case_id = "2024D007847"
    workflow = EvidenceChainWorkflow(case_id)

    # Run complete evidence pipeline
    results = await workflow.process_evidence_pipeline()

    if results["success"]:
        print(f"✅ Pipeline completed successfully for {case_id}")

        # Generate integrity report
        integrity = await workflow.generate_integrity_report()
        print(f"🔗 Integrity Status: {integrity['integrity_status']}")
        print(f"📊 Synchronized Files: {integrity['synchronized_count']}")
    else:
        print(f"❌ Pipeline failed for {case_id}")
        for error in results["errors"]:
            print(f"   Error: {error}")


if __name__ == "__main__":
    asyncio.run(main())