#!/usr/bin/env python3

"""
ChittyOS Evidence Analysis CLI
Single-path evidence analysis using ChittyOS architecture
"""

import argparse
import json
import sys
import asyncio
from pathlib import Path
from datetime import datetime
from typing import Optional, List

# Single analyzer import - ChittyOS only
from evidence_analyzer_chittyos import ChittyOSEvidenceAnalyzer

async def run_chittyos_analyzer(case_id: str, input_dir: str, queue_hard_mint: bool = False):
    """Run ChittyOS evidence analysis pipeline"""
    print(f"🔍 Running ChittyOS analysis for case {case_id}")
    print(f"📁 Input directory: {input_dir}")
    print(f"💎 Queue hard mint: {queue_hard_mint}")

    analyzer = ChittyOSEvidenceAnalyzer(case_id=case_id, input_dir=input_dir)

    print("\n⚙️  Running complete analysis pipeline...")
    await analyzer.run_analysis(mode='full', auto_mint=queue_hard_mint)

    print("\n✅ Analysis complete!")
    print(f"📂 Results stored in ChittyOS data location")

def main():
    parser = argparse.ArgumentParser(description="ChittyOS Evidence Analysis CLI")
    parser.add_argument("--case-id", required=True, help="Case identifier")
    parser.add_argument("--input-dir", default=".", help="Input directory for documents")
    parser.add_argument("--queue-hard-mint", action="store_true", help="Queue documents for ChittyLedger hard mint")

    args = parser.parse_args()

    asyncio.run(run_chittyos_analyzer(args.case_id, args.input_dir, args.queue_hard_mint))

if __name__ == '__main__':
    main()