#!/usr/bin/env python3

"""
Quick Preview of Flow of Funds Evidence
"""

import os
import json
from pathlib import Path
from datetime import datetime

def generate_quick_preview():
    """Generate quick preview of Flow of Funds evidence"""

    flow_path = Path("/Users/nb/Library/CloudStorage/GoogleDrive-nick@aribia.llc/Other computers/My Mac mini/Flow_of_Funds_Package")

    # Scan for evidence files
    evidence_summary = {
        "timestamp": datetime.now().isoformat(),
        "case_id": "2024D007847",
        "categories": {}
    }

    # Define categories and patterns
    categories = {
        "Financial Data": ["*.csv"],
        "Wire Transfer Analysis": ["WIRE_TRANSFER*.md", "*.md"],
        "Bank Statements": ["*Mercury*.pdf", "*Chase*.pdf", "*Bank*.pdf"],
        "Legal Documents": ["*TRO*.pdf", "*Motion*.pdf", "*Petition*.pdf", "*Court*.pdf"],
        "Invoices": ["*Invoice*.pdf", "*Receipt*.pdf"],
        "Contracts": ["*Agreement*.pdf", "*Contract*.pdf", "*Lease*.pdf"],
        "Communications": ["*Email*.pdf", "*Message*.pdf", "*OpenPhone*.json"]
    }

    print("🔍 Scanning Flow of Funds Package...")
    print("=" * 60)

    total_files = 0

    for category, patterns in categories.items():
        files = []
        for pattern in patterns:
            files.extend(flow_path.rglob(pattern))

        # Remove duplicates and sort by name
        unique_files = list(set(files))
        unique_files.sort(key=lambda x: x.name)

        if unique_files:
            evidence_summary["categories"][category] = []
            print(f"\n📁 {category} ({len(unique_files)} files)")
            print("-" * 40)

            for f in unique_files[:5]:  # Show first 5
                file_info = {
                    "name": f.name,
                    "path": str(f.relative_to(flow_path)),
                    "size": f.stat().st_size
                }
                evidence_summary["categories"][category].append(file_info)

                size_kb = f.stat().st_size / 1024
                print(f"   • {f.name[:50]:<50} {size_kb:>8.1f} KB")

            if len(unique_files) > 5:
                print(f"   ... and {len(unique_files) - 5} more files")

            total_files += len(unique_files)

    # Check for genie-avb directory
    genie_path = flow_path / "04_Property_Documentation/All_Lease_Agreements/Additional_Leases/genie-avb"
    if genie_path.exists():
        genie_files = list(genie_path.glob("*"))
        print(f"\n🗂️ Special Directory: genie-avb ({len(genie_files)} items)")
        print("-" * 40)
        for f in genie_files[:10]:
            print(f"   • {f.name}")
        if len(genie_files) > 10:
            print(f"   ... and {len(genie_files) - 10} more items")

    print(f"\n📊 Summary")
    print("=" * 60)
    print(f"Total Evidence Files Found: {total_files}")
    print(f"Categories Analyzed: {len(evidence_summary['categories'])}")

    # Save summary
    output_dir = Path("out")
    output_dir.mkdir(exist_ok=True)

    summary_file = output_dir / "flow_of_funds_preview.json"
    with open(summary_file, 'w') as f:
        json.dump(evidence_summary, f, indent=2)

    print(f"\n✅ Preview saved to: {summary_file}")

    # Generate markdown report
    report = f"""# Flow of Funds Evidence Preview

Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Case ID: 2024D007847

## Evidence Categories Found

"""

    for category, files in evidence_summary["categories"].items():
        report += f"### {category}\n"
        report += f"**{len(files)} files found**\n\n"
        for file_info in files[:3]:
            report += f"- {file_info['name']}\n"
        if len(files) > 3:
            report += f"- *...and more*\n"
        report += "\n"

    report += f"""
## ChittyLedger Integration Notes

- **Neon Database**: Not currently integrated (placeholder for future)
- **ChittyOS-Data Storage**: Ready at `/chittychat-data/projects/legal/{evidence_summary['case_id']}`
- **AI Processing**: Available via ai_metadata_bridge.py
- **Chain of Custody**: Tracking via chain_status_workflow.py

## Next Steps

1. Install `notion-client` to enable full ChittyLedger integration
2. Run `/evidence-pipeline` command to process all evidence
3. Use `/ai-enhance` on specific high-priority files
4. Generate integrity report with `/integrity-check`

---
*This is an early preview. Full processing will analyze {total_files} evidence files.*
"""

    report_file = output_dir / "flow_of_funds_preview.md"
    with open(report_file, 'w') as f:
        f.write(report)

    print(f"📄 Report saved to: {report_file}")

    return evidence_summary

if __name__ == "__main__":
    generate_quick_preview()