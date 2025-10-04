#!/usr/bin/env python3
"""
Enhance Timeline for Notion - Add file links, contradictions, and helpful columns
"""

import csv
import os
import hashlib
from pathlib import Path

def detect_contradictions(description):
    """Detect potential contradictions in descriptions"""
    contradiction_keywords = [
        'contradict', 'contradiction', 'contrary to', 'disputes',
        'refutes', 'challenges', 'denies', 'opposes',
        'conflicts with', 'inconsistent', 'contradicts'
    ]

    if not description:
        return False

    desc_lower = description.lower()
    return any(keyword in desc_lower for keyword in contradiction_keywords)

def detect_evidence_type(description, source_file):
    """Classify evidence type based on content"""
    if not description:
        return "UNKNOWN"

    desc_lower = description.lower()
    source_lower = source_file.lower() if source_file else ""

    # Message evidence
    if any(term in desc_lower for term in ['imessage', 'text message', 'whatsapp', 'sms']):
        return "MESSAGE_EVIDENCE"

    # Email evidence
    if any(term in desc_lower for term in ['email', 'correspondence', 'communication']):
        return "EMAIL_EVIDENCE"

    # Financial evidence
    if any(term in desc_lower for term in ['payment', 'transfer', 'bank', 'financial', '$']):
        return "FINANCIAL_EVIDENCE"

    # TRO related
    if any(term in desc_lower for term in ['tro', 'restraining order', 'emergency']):
        return "TRO_EVIDENCE"

    # Property evidence
    if any(term in desc_lower for term in ['property', 'deed', 'title', 'real estate']):
        return "PROPERTY_EVIDENCE"

    # Legal documents
    if any(term in source_lower for term in ['petition', 'motion', 'filing', 'brief']):
        return "LEGAL_DOCUMENT"

    return "GENERAL_EVIDENCE"

def extract_participants(description):
    """Extract key participants from descriptions"""
    participants = []

    if not description:
        return ""

    desc_lower = description.lower()

    # Key people
    if 'luisa' in desc_lower or 'arias' in desc_lower:
        participants.append('Luisa Arias')
    if 'nicholas' in desc_lower or 'nick' in desc_lower or 'bianchi' in desc_lower:
        participants.append('Nicholas Bianchi')
    if 'sharon' in desc_lower and 'jones' in desc_lower:
        participants.append('Sharon Jones')
    if 'aribia' in desc_lower:
        participants.append('ARIBIA LLC')

    return ', '.join(participants)

def generate_file_link(source_file):
    """Generate file path for evidence links"""
    if not source_file or source_file == 'unknown':
        return ""

    # Check common evidence directories
    evidence_paths = [
        f"/Users/nb/.claude/projects/-/legal/case/{source_file}",
        f"/Users/nb/.claude/projects/-/legal/case/out/{source_file}",
        f"/Users/nb/.claude/projects/-/legal/case/evidence/{source_file}",
        f"/Users/nb/Library/CloudStorage/GoogleDrive-nick@aribia.llc/Shared drives/chittychat-data/legal/case/2024D007847/{source_file}"
    ]

    # Return first existing path
    for path in evidence_paths:
        if os.path.exists(path):
            return path

    # Return default path structure
    return f"/Users/nb/.claude/projects/-/legal/case/{source_file}"

def extract_amounts(description):
    """Extract monetary amounts from descriptions"""
    if not description:
        return ""

    import re
    # Find patterns like $X,XXX or $X,XXX.XX
    amounts = re.findall(r'\$[\d,]+(?:\.\d{2})?', description)
    return ', '.join(amounts) if amounts else ""

def enhance_timeline():
    """Enhance timeline CSV with additional helpful columns"""

    input_file = 'out/timeline_master_with_chittyids.csv'
    output_file = 'out/timeline_enhanced_for_notion.csv'

    print("🔄 Enhancing timeline for Notion import...")

    enhanced_rows = []

    with open(input_file, 'r') as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames)

        # Add new helpful columns
        new_fields = [
            'evidence_type',
            'contradiction_flag',
            'participants_extracted',
            'file_link',
            'amounts_mentioned',
            'legal_significance',
            'notion_ready'
        ]

        fieldnames.extend(new_fields)

        for row in reader:
            description = row.get('description', '')
            source_file = row.get('source_file', '')

            # Enhance the row
            row['evidence_type'] = detect_evidence_type(description, source_file)
            row['contradiction_flag'] = 'YES' if detect_contradictions(description) else 'NO'
            row['participants_extracted'] = extract_participants(description)
            row['file_link'] = generate_file_link(source_file)
            row['amounts_mentioned'] = extract_amounts(description)

            # Legal significance scoring
            significance_score = 0
            if row['contradiction_flag'] == 'YES':
                significance_score += 3
            if any(term in description.lower() for term in ['tro', 'emergency', 'petition']):
                significance_score += 2
            if row['evidence_type'] in ['MESSAGE_EVIDENCE', 'EMAIL_EVIDENCE']:
                significance_score += 2
            if 'aribia' in description.lower():
                significance_score += 1

            if significance_score >= 4:
                row['legal_significance'] = 'HIGH'
            elif significance_score >= 2:
                row['legal_significance'] = 'MEDIUM'
            else:
                row['legal_significance'] = 'LOW'

            # Mark as notion ready if has useful content
            if (len(description) > 20 and
                description not in ['', 'N/A', 'Unknown'] and
                not description.startswith('|')):
                row['notion_ready'] = 'YES'
            else:
                row['notion_ready'] = 'NO'

            enhanced_rows.append(row)

    # Write enhanced CSV
    with open(output_file, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(enhanced_rows)

    # Generate summary
    total_rows = len(enhanced_rows)
    notion_ready = sum(1 for row in enhanced_rows if row['notion_ready'] == 'YES')
    contradictions = sum(1 for row in enhanced_rows if row['contradiction_flag'] == 'YES')
    high_significance = sum(1 for row in enhanced_rows if row['legal_significance'] == 'HIGH')

    print(f"✅ Enhanced timeline saved to: {output_file}")
    print(f"📊 Summary:")
    print(f"  • Total timeline events: {total_rows:,}")
    print(f"  • Notion-ready entries: {notion_ready:,}")
    print(f"  • Contradiction evidence: {contradictions:,}")
    print(f"  • High legal significance: {high_significance:,}")

    # Evidence type breakdown
    evidence_types = {}
    for row in enhanced_rows:
        etype = row.get('evidence_type', 'UNKNOWN')
        evidence_types[etype] = evidence_types.get(etype, 0) + 1

    print(f"\n📋 Evidence Types:")
    for etype, count in sorted(evidence_types.items(), key=lambda x: x[1], reverse=True):
        print(f"  • {etype}: {count:,}")

    return output_file

if __name__ == '__main__':
    enhance_timeline()