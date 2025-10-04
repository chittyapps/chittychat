#!/usr/bin/env python3
"""
Check Notion database properties
"""

import os
import requests
import json

def get_database_schema(token, database_id):
    """Get the schema of a Notion database"""
    url = f"https://api.notion.com/v1/databases/{database_id}"

    headers = {
        "Authorization": f"Bearer {token}",
        "Notion-Version": "2022-06-28"
    }

    response = requests.get(url, headers=headers)
    if response.ok:
        data = response.json()
        return data.get("properties", {}), data.get("title", [])
    else:
        print(f"Error: {response.json()}")
        return None, None

def main():
    NOTION_TOKEN = os.getenv("NOTION_TOKEN")

    databases = [
        ("a1447612bebc41a290d3b840fac7f73d", "First database"),
        ("3a168a269d06425fbc308ab6ab66d28b", "Second database")
    ]

    for db_id, db_name in databases:
        print(f"\n📊 Checking {db_name}: {db_id}")
        properties, title = get_database_schema(NOTION_TOKEN, db_id)

        if properties:
            if title:
                title_text = ''.join([t.get('plain_text', '') for t in title])
                print(f"   Title: {title_text}")

            print(f"   Properties:")
            for prop_name, prop_config in properties.items():
                prop_type = prop_config.get("type", "unknown")
                print(f"     - {prop_name} ({prop_type})")
        else:
            print(f"   ❌ Could not access database")

if __name__ == "__main__":
    main()