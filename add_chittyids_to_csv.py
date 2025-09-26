#!/usr/bin/env python3
"""
Add ChittyIDs to Timeline CSV - Case 2024D007847
Requests ChittyIDs from id.chitty.cc service for each row
"""

import csv
import json
import os
import time
from urllib.request import urlopen, Request
from urllib.error import HTTPError
import urllib.parse

def request_chitty_id(entity_type="EVNT", subtype="COMM"):
    """Request ChittyID from id.chitty.cc service"""
    token = os.getenv('CHITTY_ID_TOKEN')
    if not token:
        raise ValueError("CHITTY_ID_TOKEN environment variable required")

    data = json.dumps({
        'domain': entity_type,
        'subtype': subtype
    }).encode('utf-8')

    request = Request(
        'https://id.chitty.cc/v1/mint',
        data=data,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }
    )

    try:
        response = urlopen(request)
        result = json.loads(response.read().decode('utf-8'))
        return result['chitty_id']
    except HTTPError as e:
        if e.code == 429:  # Rate limit
            print(f"Rate limited, waiting 2 seconds...")
            time.sleep(2)
            return request_chitty_id(entity_type, subtype)  # Retry
        else:
            raise Exception(f"ChittyID service error: {e.code}")

def process_timeline_csv():
    """Add ChittyIDs to timeline master CSV"""

    input_file = 'out/timeline_master.csv'
    output_file = 'out/timeline_master_with_chittyids.csv'

    print(f"🔄 Processing {input_file}...")

    # Read input CSV
    rows = []
    with open(input_file, 'r') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames

        for row in reader:
            rows.append(row)

    print(f"📊 Found {len(rows)} rows to process")

    # Add service_chitty_id to fieldnames if not present
    if 'service_chitty_id' not in fieldnames:
        fieldnames = list(fieldnames) + ['service_chitty_id']

    # Process each row and request ChittyID
    processed = 0

    with open(output_file, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for idx, row in enumerate(rows):
            # Determine entity type from content
            description = row.get('description', '').lower()

            if any(term in description for term in ['email', 'message', 'communication']):
                entity_type = "EVNT"
                subtype = "COMM"
            elif any(term in description for term in ['payment', 'transfer', 'financial']):
                entity_type = "EVNT"
                subtype = "FINL"
            elif any(term in description for term in ['agreement', 'contract', 'document']):
                entity_type = "PROP"
                subtype = "DOCU"
            else:
                entity_type = "EVNT"
                subtype = "MISC"

            try:
                # Request ChittyID from service
                chitty_id = request_chitty_id(entity_type, subtype)
                row['service_chitty_id'] = chitty_id

                processed += 1
                if processed % 10 == 0:
                    print(f"✅ Processed {processed}/{len(rows)} rows (latest: {chitty_id})")

                # Rate limiting - be respectful to service
                time.sleep(0.5)

            except Exception as e:
                print(f"❌ Error for row {idx}: {e}")
                row['service_chitty_id'] = f"ERROR_{idx}"

            writer.writerow(row)

    print(f"🎉 Complete! Generated {output_file}")
    print(f"📊 Successfully processed {processed}/{len(rows)} rows")

    return output_file

def main():
    """Main execution function"""

    # Check required environment
    if not os.getenv('CHITTY_ID_TOKEN'):
        print("❌ CHITTY_ID_TOKEN environment variable required")
        return False

    try:
        output_file = process_timeline_csv()

        # Show sample of results
        print("\n📋 Sample results:")
        with open(output_file, 'r') as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader):
                if i < 3:  # Show first 3 rows
                    chitty_id = row.get('service_chitty_id', 'N/A')
                    desc = row.get('description', '')[:50] + '...'
                    print(f"  • {chitty_id}: {desc}")
                if i >= 2:
                    break

        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)