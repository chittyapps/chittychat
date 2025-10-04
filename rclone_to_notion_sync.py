#!/usr/bin/env python3
"""
RClone to Notion Sync
Syncs ALL files from Google Drive (via rclone) to Notion database
"""

import os
import json
import subprocess
import hashlib
from datetime import datetime
import requests
import time

def get_all_files_from_rclone(remote="arias_v_bianchi:"):
    """Get complete file list from rclone remote with deduplication"""
    print(f"🔍 Fetching file list from rclone remote: {remote}")

    try:
        # Get detailed file listing with size and path
        result = subprocess.run(
            ["rclone", "lsjson", remote, "--recursive"],
            capture_output=True,
            text=True,
            check=True
        )

        files = json.loads(result.stdout)
        print(f"✅ Found {len(files)} total files in Google Drive")

    except subprocess.CalledProcessError as e:
        print(f"⚠️  JSON listing failed, using simple listing")
        # Fallback to simple listing
        try:
            result = subprocess.run(
                ["rclone", "ls", remote],
                capture_output=True,
                text=True,
                check=True
            )

            files = []
            for line in result.stdout.strip().split('\n'):
                if line:
                    parts = line.strip().split(None, 1)
                    if len(parts) == 2:
                        size, path = parts
                        files.append({
                            'Path': path,
                            'Size': int(size),
                            'Name': os.path.basename(path)
                        })

            print(f"✅ Found {len(files)} files via simple listing")

        except Exception as fallback_error:
            print(f"❌ Could not fetch files: {fallback_error}")
            return []

    # Deduplicate files
    print("🔄 Deduplicating files...")
    seen = {}
    deduplicated = []

    for file in files:
        # Create unique key based on name and size
        file_name = file.get('Name', os.path.basename(file.get('Path', '')))
        file_size = file.get('Size', 0)
        key = f"{file_name}_{file_size}"

        if key not in seen:
            seen[key] = file
            deduplicated.append(file)
        else:
            # Keep the one with the shorter path (likely the original)
            existing_path = seen[key].get('Path', '')
            new_path = file.get('Path', '')
            if len(new_path) < len(existing_path):
                # Replace with shorter path version
                old_file = seen[key]
                seen[key] = file
                # Find and replace in deduplicated list
                for i, dedup_file in enumerate(deduplicated):
                    if dedup_file == old_file:
                        deduplicated[i] = file
                        break

    duplicate_count = len(files) - len(deduplicated)
    if duplicate_count > 0:
        print(f"✅ Removed {duplicate_count} duplicate files")

    print(f"📊 Unique files to sync: {len(deduplicated)}")
    return deduplicated

def categorize_file(file_info):
    """Categorize file based on name and extension"""
    name = file_info.get('Name', file_info.get('Path', '')).lower()

    # Evidence categories
    if 'photo' in name or '.jpg' in name or '.png' in name:
        return 'Photo Evidence'
    elif '.pdf' in name:
        if 'letter' in name or 'notice' in name:
            return 'Legal Correspondence'
        elif 'bank' in name or 'statement' in name:
            return 'Financial Records'
        elif 'lease' in name or 'property' in name:
            return 'Property Documents'
        else:
            return 'PDF Document'
    elif '.csv' in name or '.xlsx' in name:
        return 'Data/Spreadsheet'
    elif '.json' in name:
        return 'Structured Data'
    elif '.txt' in name or '.md' in name:
        return 'Text Document'
    elif '.mp4' in name or '.mov' in name:
        return 'Video Evidence'
    elif '.mp3' in name or '.m4a' in name:
        return 'Audio Evidence'
    elif 'imessage' in name or 'sms' in name:
        return 'Message History'
    elif 'email' in name or '.eml' in name:
        return 'Email Evidence'
    else:
        return 'Other Evidence'

def sync_to_notion(token, database_id, file_info, remote="arias_v_bianchi:"):
    """Create Notion entry for file"""
    url = "https://api.notion.com/v1/pages"

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"  # Standard API version
    }

    # Generate unique ID
    file_path = file_info.get('Path', file_info.get('Name', 'unknown'))
    chitty_id = hashlib.sha256(file_path.encode()).hexdigest()[:12].upper()

    # Get file details
    file_name = file_info.get('Name', os.path.basename(file_path))
    file_size_mb = file_info.get('Size', 0) / (1024 * 1024)
    category = categorize_file(file_info)

    # Build rclone link (can be used with rclone mount or copy commands)
    rclone_path = f"{remote}{file_path}"

    properties = {
        "Document Name": {
            "title": [{
                "text": {"content": file_name[:100]}  # Limit to 100 chars
            }]
        },
        "File Path": {
            "rich_text": [{
                "text": {"content": rclone_path[:500]}  # Limit to 500 chars
            }]
        },
        "Document Type": {
            "select": {"name": category}
        },
        "Import Date": {
            "date": {"start": datetime.now().isoformat()}
        },
        "Processing Status": {
            "select": {"name": "Indexed"}
        },
        "File Size (MB)": {
            "number": round(file_size_mb, 3)
        },
        "Keywords": {
            "rich_text": [{
                "text": {"content": f"RCLONE-{chitty_id}, {category}"}
            }]
        },
        "Source System": {
            "select": {"name": "Google Drive"}
        }
    }

    # Set priority based on file type
    if any(keyword in file_name.lower() for keyword in ['urgent', 'critical', 'important', 'tro', 'court']):
        properties["Priority Level"] = {"select": {"name": "High"}}
    else:
        properties["Priority Level"] = {"select": {"name": "Medium"}}

    # Mark PII for sensitive files
    if any(keyword in file_name.lower() for keyword in ['ssn', 'tax', 'bank', 'medical', 'therapy']):
        properties["Contains PII"] = {"checkbox": True}

    data = {
        "parent": {"database_id": database_id},
        "properties": properties
    }

    try:
        response = requests.post(url, headers=headers, json=data)
        return response.json()
    except Exception as e:
        return {"error": str(e)}

def main():
    REMOTE = "arias_v_bianchi:"
    NOTION_DATABASE_ID = "a1447612bebc41a290d3b840fac7f73d"  # Using first database (working)
    NOTION_TOKEN = os.getenv("NOTION_TOKEN")

    print("=" * 60)
    print("📂 RClone to Notion Complete Sync")
    print(f"🗄️  Remote: {REMOTE}")
    print(f"📊 Notion Database: {NOTION_DATABASE_ID}")
    print("=" * 60)

    # Get all files from rclone
    all_files = get_all_files_from_rclone(REMOTE)

    if not all_files:
        print("❌ No files found")
        return

    # Sort files by size (process smaller files first)
    all_files.sort(key=lambda x: x.get('Size', 0))

    print(f"\n📈 File Statistics:")
    total_size = sum(f.get('Size', 0) for f in all_files)
    print(f"   Total files: {len(all_files)}")
    print(f"   Total size: {total_size / (1024**3):.2f} GB")

    # Group by category
    categories = {}
    for f in all_files:
        cat = categorize_file(f)
        if cat not in categories:
            categories[cat] = 0
        categories[cat] += 1

    print(f"\n📊 Files by category:")
    for cat, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
        print(f"   {cat}: {count}")

    print("\n" + "=" * 60)
    print("🔄 Starting sync to Notion...")
    print("=" * 60)

    success_count = 0
    error_count = 0
    skip_count = 0
    batch_size = 50
    delay = 0.1  # Small delay to avoid rate limits

    for i in range(0, len(all_files), batch_size):
        batch = all_files[i:i+batch_size]
        batch_num = i // batch_size + 1
        total_batches = (len(all_files) - 1) // batch_size + 1

        print(f"\n📦 Batch {batch_num}/{total_batches} ({len(batch)} files)...")

        for file_info in batch:
            file_name = file_info.get('Name', 'unknown')[:50]

            # Skip certain file types that shouldn't be synced
            if file_name.startswith('.') or file_name.endswith('.tmp'):
                skip_count += 1
                continue

            try:
                result = sync_to_notion(NOTION_TOKEN, NOTION_DATABASE_ID, file_info, REMOTE)

                if result.get('id'):
                    success_count += 1
                    if success_count % 10 == 0:
                        print(f"   ✅ Synced {success_count} files...")
                else:
                    error_count += 1
                    if 'message' in result:
                        print(f"   ⚠️  {file_name}: {result['message'][:50]}")

                time.sleep(delay)  # Rate limiting

            except Exception as e:
                error_count += 1
                print(f"   ❌ {file_name}: {str(e)[:50]}")

        # Progress update
        progress = ((i + len(batch)) / len(all_files)) * 100
        print(f"   📊 Progress: {progress:.1f}% ({success_count} synced, {error_count} errors, {skip_count} skipped)")

    # Final summary
    print("\n" + "=" * 60)
    print("✅ SYNC COMPLETE")
    print("=" * 60)
    print(f"📊 Final Statistics:")
    print(f"   Total files: {len(all_files)}")
    print(f"   Successfully synced: {success_count}")
    print(f"   Errors: {error_count}")
    print(f"   Skipped: {skip_count}")
    print(f"   Success rate: {(success_count / len(all_files) * 100):.1f}%")

    print(f"\n🔗 View in Notion: https://www.notion.so/{NOTION_DATABASE_ID}")

    # Save detailed report
    report = {
        "timestamp": datetime.now().isoformat(),
        "remote": REMOTE,
        "total_files": len(all_files),
        "synced": success_count,
        "errors": error_count,
        "skipped": skip_count,
        "total_size_gb": total_size / (1024**3),
        "categories": categories
    }

    os.makedirs("out", exist_ok=True)
    report_path = "out/rclone_notion_sync_report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)

    print(f"\n📋 Detailed report saved to: {report_path}")

if __name__ == "__main__":
    main()