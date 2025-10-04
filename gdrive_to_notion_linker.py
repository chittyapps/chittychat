#!/usr/bin/env python3
"""
Google Drive to Notion Document Linker
Links documents from Google Drive folder to Notion database
"""

import os
import json
import hashlib
from datetime import datetime
import requests
from urllib.parse import urlparse, parse_qs

def extract_folder_id(url):
    """Extract folder ID from Google Drive URL"""
    # URL format: https://drive.google.com/drive/folders/FOLDER_ID
    if 'folders/' in url:
        return url.split('folders/')[-1].split('?')[0]
    return None

def generate_chitty_id(file_name):
    """Generate a local ChittyID fallback"""
    timestamp = datetime.now().strftime('%y%m')
    hash_val = hashlib.sha256(file_name.encode()).hexdigest()[:8].upper()
    return f"LOCAL-DOC-{timestamp}-{hash_val}"

def create_notion_entry(token, database_id, file_data):
    """Create a Notion database entry for a file"""
    url = "https://api.notion.com/v1/pages"

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
    }

    properties = {
        "Document Name": {
            "title": [
                {
                    "text": {
                        "content": file_data.get("name", "Untitled")
                    }
                }
            ]
        },
        "File Path": {
            "rich_text": [
                {
                    "text": {
                        "content": file_data.get("drive_url", "")
                    }
                }
            ]
        },
        "Document Type": {
            "select": {
                "name": file_data.get("file_type", "Document")
            }
        },
        "Import Date": {
            "date": {
                "start": datetime.now().isoformat()
            }
        },
        "Processing Status": {
            "select": {
                "name": "Imported"
            }
        },
        "Case Relevance": {
            "select": {
                "name": "High"
            }
        },
        "Priority Level": {
            "select": {
                "name": "High"
            }
        },
        "Source System": {
            "select": {
                "name": "Google Drive"
            }
        }
    }

    # Add description as content summary
    if file_data.get("description"):
        properties["Content Summary"] = {
            "rich_text": [
                {
                    "text": {
                        "content": file_data.get("description", "")
                    }
                }
            ]
        }

    data = {
        "parent": {"database_id": database_id},
        "properties": properties
    }

    response = requests.post(url, headers=headers, json=data)
    return response.json()

def main():
    # Configuration
    GDRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1z94eXE1I4OeFipZBSYKHq2b7zi0t_A1g"
    # Try the first database ID
    NOTION_DATABASE_ID = os.environ.get("CHITTYLEGDER_DATABASE_ID", "a1447612bebc41a290d3b840fac7f73d")
    NOTION_TOKEN = os.environ.get("NOTION_TOKEN")

    # Try to get token from 1Password if not in environment
    if not NOTION_TOKEN:
        try:
            import subprocess
            result = subprocess.run(
                ["op", "item", "get", "ovtgpw342cgc5kkoticzmsszjy", "--reveal", "--fields", "label=credential"],
                capture_output=True,
                text=True
            )
            if result.returncode == 0:
                NOTION_TOKEN = result.stdout.strip()
                print("✅ Token loaded from 1Password")
            else:
                print("❌ Could not load NOTION_TOKEN from 1Password")
                return
        except Exception as e:
            print(f"❌ Error loading token: {str(e)}")
            return

    folder_id = extract_folder_id(GDRIVE_FOLDER_URL)
    print(f"📁 Google Drive Folder ID: {folder_id}")
    print(f"📊 Notion Database ID: {NOTION_DATABASE_ID}")

    # Sample document entries - in production, this would be populated from Google Drive API
    # For now, we'll create entries with direct links
    documents = [
        {
            "name": "Case Evidence - Main Folder",
            "drive_url": GDRIVE_FOLDER_URL,
            "file_type": "Folder",
            "description": "Main evidence folder for case 2024D007847"
        },
        {
            "name": "Timeline Analysis",
            "drive_url": f"https://drive.google.com/file/d/{folder_id}/timeline_master.csv",
            "file_type": "CSV",
            "description": "Master timeline with 1,433+ communication events"
        },
        {
            "name": "Contradiction Analysis",
            "drive_url": f"https://drive.google.com/file/d/{folder_id}/contradiction_evidence.json",
            "file_type": "JSON",
            "description": "Automated contradiction detection results"
        },
        {
            "name": "OpenPhone Communications",
            "drive_url": f"https://drive.google.com/file/d/{folder_id}/openphone_analysis.md",
            "file_type": "Document",
            "description": "Business communication analysis from OpenPhone"
        }
    ]

    print(f"\\n🔄 Syncing {len(documents)} items to Notion...")

    success_count = 0
    for doc in documents:
        # Generate ChittyID
        doc["chitty_id"] = generate_chitty_id(doc["name"])

        print(f"  📄 Creating entry for: {doc['name']}")

        try:
            result = create_notion_entry(NOTION_TOKEN, NOTION_DATABASE_ID, doc)

            if result.get("id"):
                print(f"    ✅ Created: {result['id']}")
                success_count += 1
            else:
                print(f"    ⚠️  Error: {result.get('message', 'Unknown error')}")
        except Exception as e:
            print(f"    ❌ Failed: {str(e)}")

    print(f"\\n✅ Successfully created {success_count}/{len(documents)} entries in Notion")
    print(f"🔗 View database: https://www.notion.so/{NOTION_DATABASE_ID}")

    # Save summary
    summary = {
        "sync_timestamp": datetime.now().isoformat(),
        "folder_id": folder_id,
        "notion_database_id": NOTION_DATABASE_ID,
        "documents_synced": success_count,
        "total_documents": len(documents)
    }

    os.makedirs("out", exist_ok=True)
    with open("out/gdrive_notion_sync_summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    print(f"\\n📋 Summary saved to: out/gdrive_notion_sync_summary.json")

if __name__ == "__main__":
    main()