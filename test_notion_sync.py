#!/usr/bin/env python3
"""
Test Notion sync with just a few files
"""

import requests
from datetime import datetime

def test_notion_connection():
    NOTION_DATABASE_ID = "3a168a269d06425fbc308ab6ab66d28b"
    NOTION_TOKEN = os.getenv("NOTION_TOKEN")

    # Test with a single entry
    url = "https://api.notion.com/v1/pages"

    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"  # Try with standard version first
    }

    test_data = {
        "parent": {"database_id": NOTION_DATABASE_ID},
        "properties": {
            "Name": {
                "title": [{
                    "text": {"content": f"Test Entry - {datetime.now().strftime('%H:%M:%S')}"}
                }]
            }
        }
    }

    print(f"🧪 Testing connection to database: {NOTION_DATABASE_ID}")

    response = requests.post(url, headers=headers, json=test_data)

    if response.ok:
        print("✅ Successfully connected and created test entry!")
        print(f"   Entry ID: {response.json().get('id')}")
        return True
    else:
        print(f"❌ Failed: {response.status_code}")
        print(f"   Error: {response.json()}")

        # Try with newer API version
        if "2025-09-03" not in headers["Notion-Version"]:
            print("\n🔄 Trying with newer API version (2025-09-03)...")
            headers["Notion-Version"] = "2025-09-03"
            response = requests.post(url, headers=headers, json=test_data)

            if response.ok:
                print("✅ Success with newer API version!")
                return True
            else:
                print(f"❌ Still failed: {response.json()}")

        return False

if __name__ == "__main__":
    test_notion_connection()