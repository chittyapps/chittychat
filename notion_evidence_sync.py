#!/usr/bin/env python3

"""
Notion Evidence Sync for Arias v. Bianchi
Syncs evidence analysis to Notion for case management
"""

import os
import json
import pandas as pd
from datetime import datetime
from pathlib import Path
import click

# Try to import notion client
try:
    from notion_client import Client
    NOTION_AVAILABLE = True
except ImportError:
    NOTION_AVAILABLE = False

@click.command()
@click.option('--notion-token', envvar='NOTION_TOKEN', help='Notion integration token')
@click.option('--database-id', envvar='NOTION_DATABASE_ID', help='Notion database ID for evidence')
@click.option('--test', is_flag=True, help='Test mode - show what would be synced')
@click.option('--case-name', default='Arias v. Bianchi', help='Case name')
@click.option('--case-id', default='2024D007847', help='Case ID')
def sync_to_notion(notion_token, database_id, test, case_name, case_id):
    """Sync evidence data to Notion"""

    if not NOTION_AVAILABLE:
        click.echo("❌ Notion client not installed")
        click.echo("Run: pip3 install notion-client")
        return

    if not notion_token:
        click.echo("❌ No Notion token provided!")
        click.echo("1. Go to https://www.notion.so/my-integrations")
        click.echo("2. Create new integration")
        click.echo("3. Copy the token")
        click.echo("4. Set NOTION_TOKEN environment variable")
        return

    if not database_id:
        click.echo("❌ No database ID provided!")
        click.echo("1. Create a database in Notion")
        click.echo("2. Share it with your integration")
        click.echo("3. Copy the database ID from the URL")
        click.echo("4. Set NOTION_DATABASE_ID environment variable")
        return

    click.echo(f"📊 Syncing evidence for {case_name} to Notion")

    # Load evidence data
    timeline_path = Path("out/timeline_master.csv")
    exhibit_path = Path("out/exhibit_index.csv")

    if not timeline_path.exists():
        click.echo(f"❌ Timeline file not found: {timeline_path}")
        return

    timeline_df = pd.read_csv(timeline_path)
    exhibit_df = pd.read_csv(exhibit_path) if exhibit_path.exists() else pd.DataFrame()

    click.echo(f"📥 Loaded {len(timeline_df)} timeline items")
    click.echo(f"📥 Loaded {len(exhibit_df)} exhibit items")

    if test:
        click.echo("\n🧪 TEST MODE - Preview of data to sync:")

        # Show summary statistics
        click.echo(f"\n📊 Evidence Summary:")
        click.echo(f"   • Total items: {len(timeline_df)}")
        click.echo(f"   • Exhibits: {len(exhibit_df)}")

        # Show event types
        if 'type' in timeline_df.columns:
            type_counts = timeline_df['type'].value_counts()
            click.echo(f"\n📋 Event Types:")
            for event_type, count in type_counts.items():
                click.echo(f"   • {event_type}: {count}")

        # Show recent items
        click.echo(f"\n📅 Recent Evidence Items:")
        recent_items = timeline_df.head(5)
        for _, item in recent_items.iterrows():
            date = item.get('timestamp', item.get('date', 'Unknown'))
            desc = str(item.get('description', item.get('content', 'No description')))[:100]
            click.echo(f"   • {date}: {desc}")

        # Show exhibit samples
        if not exhibit_df.empty:
            click.echo(f"\n🏷️  Sample Exhibits:")
            for _, exhibit in exhibit_df.head(3).iterrows():
                exhibit_id = exhibit.get('exhibit_id', 'Unknown')
                desc = str(exhibit.get('description', 'No description'))[:80]
                click.echo(f"   • {exhibit_id}: {desc}")

        click.echo(f"\n✅ Test complete. Use --test=false to perform actual sync")
        return

    # Initialize Notion client
    try:
        notion = Client(auth=notion_token)
        click.echo("✅ Connected to Notion")
    except Exception as e:
        click.echo(f"❌ Failed to connect to Notion: {e}")
        return

    # Test database access
    try:
        database = notion.databases.retrieve(database_id=database_id)
        click.echo(f"✅ Found database: {database['title'][0]['plain_text']}")
    except Exception as e:
        click.echo(f"❌ Cannot access database: {e}")
        click.echo("Make sure the database is shared with your integration")
        return

    # Sync evidence items
    click.echo("\n📤 Syncing evidence to Notion...")

    synced_count = 0
    error_count = 0

    # Sync timeline items (limit to recent items to avoid rate limits)
    recent_timeline = timeline_df.head(50)  # Sync most recent 50 items

    for _, item in recent_timeline.iterrows():
        try:
            # Prepare properties for Notion
            properties = {
                "Title": {
                    "title": [
                        {
                            "text": {
                                "content": str(item.get('description', 'Evidence Item'))[:100]
                            }
                        }
                    ]
                },
                "Case": {
                    "rich_text": [
                        {
                            "text": {
                                "content": case_name
                            }
                        }
                    ]
                },
                "Type": {
                    "select": {
                        "name": str(item.get('type', 'other'))
                    }
                },
                "Date": {
                    "date": {
                        "start": str(item.get('timestamp', item.get('date', datetime.now().isoformat())))[:10]
                    }
                },
                "Source": {
                    "rich_text": [
                        {
                            "text": {
                                "content": str(item.get('source', item.get('source_file', 'Unknown')))[:100]
                            }
                        }
                    ]
                },
                "Confidence": {
                    "select": {
                        "name": str(item.get('confidence', 'medium'))
                    }
                }
            }

            # Add content if available
            content_text = str(item.get('content', item.get('description', '')))
            if content_text and content_text != 'nan':
                properties["Content"] = {
                    "rich_text": [
                        {
                            "text": {
                                "content": content_text[:2000]  # Notion limit
                            }
                        }
                    ]
                }

            # Create page in Notion
            notion.pages.create(
                parent={"database_id": database_id},
                properties=properties
            )

            synced_count += 1

        except Exception as e:
            error_count += 1
            if error_count <= 3:  # Show first few errors
                click.echo(f"⚠️  Error syncing item: {e}")

    click.echo(f"\n✅ Sync complete!")
    click.echo(f"   • Synced: {synced_count} items")
    click.echo(f"   • Errors: {error_count} items")

    # Generate sync report
    report = {
        "sync_timestamp": datetime.now().isoformat(),
        "case_name": case_name,
        "case_id": case_id,
        "total_timeline_items": len(timeline_df),
        "total_exhibits": len(exhibit_df),
        "synced_items": synced_count,
        "sync_errors": error_count,
        "notion_database_id": database_id
    }

    # Save sync report
    with open("out/notion_sync_report.json", "w") as f:
        json.dump(report, f, indent=2)

    click.echo(f"📄 Sync report saved to: out/notion_sync_report.json")

    # Show next steps
    click.echo(f"\n🔗 View your evidence in Notion:")
    click.echo(f"   https://notion.so/{database_id.replace('-', '')}")

if __name__ == '__main__':
    sync_to_notion()