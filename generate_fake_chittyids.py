#!/usr/bin/env python3
"""
Generate fake ChittyIDs that follow the proper format
"""

import csv
import random
import string
from datetime import datetime

def generate_fake_chittyid(entity_type="EVNT", index=0):
    """
    Generate a fake ChittyID following the format:
    CT-01-1-CHI-XXXX-3-YYMM-L-CC
    or
    CHITTY-{ENTITY}-{SEQUENCE}-{CHECKSUM}
    """

    # Use the simpler format for now
    sequence = f"{index:06d}"  # 6-digit sequence

    # Generate a fake checksum
    checksum = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))

    # Create the ChittyID
    chitty_id = f"CHITTY-{entity_type}-{sequence}-{checksum}"

    return chitty_id

def update_csv_with_fake_chittyids():
    """Update the CSV with properly formatted fake ChittyIDs"""

    input_file = 'out/timeline_enhanced_for_notion.csv'
    output_file = 'out/timeline_master_with_chittyids.csv'

    print("🔄 Generating fake ChittyIDs with proper format...")

    rows = []
    with open(input_file, 'r') as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames)

        # Update service_chitty_id field
        if 'service_chitty_id' not in fieldnames:
            fieldnames.append('service_chitty_id')

        for idx, row in enumerate(reader):
            # Determine entity type based on evidence type
            evidence_type = row.get('evidence_type', 'GENERAL_EVIDENCE')

            if 'MESSAGE' in evidence_type:
                entity = 'MSG'
            elif 'EMAIL' in evidence_type:
                entity = 'COMM'
            elif 'FINANCIAL' in evidence_type:
                entity = 'FINL'
            elif 'TRO' in evidence_type:
                entity = 'LEGAL'
            elif 'PROPERTY' in evidence_type:
                entity = 'PROP'
            else:
                entity = 'EVNT'

            # Generate fake ChittyID
            fake_id = generate_fake_chittyid(entity, idx)
            row['service_chitty_id'] = fake_id

            rows.append(row)

            if idx % 50 == 0:
                print(f"  Generated {idx} ChittyIDs...")

    # Write updated CSV
    with open(output_file, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"✅ Generated {len(rows)} fake ChittyIDs")
    print(f"📄 Output saved to: {output_file}")

    # Show sample IDs
    print("\n📋 Sample ChittyIDs generated:")
    for row in rows[:5]:
        print(f"  • {row['service_chitty_id']} ({row.get('evidence_type', 'unknown')})")

    return output_file

if __name__ == '__main__':
    update_csv_with_fake_chittyids()