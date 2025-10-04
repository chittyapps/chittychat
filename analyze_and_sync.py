#!/usr/bin/env python3
"""
Google Drive Content Analysis and Notion Sync
Downloads files, analyzes content, then syncs with analysis to Notion
"""

import os
import json
import subprocess
import hashlib
from datetime import datetime
import requests
import tempfile
import PyPDF2
import csv
import re
from pathlib import Path

def download_file_from_gdrive(remote, file_path, local_dir="/tmp/evidence_analysis"):
    """Download a file from Google Drive using rclone"""
    os.makedirs(local_dir, exist_ok=True)
    local_path = os.path.join(local_dir, os.path.basename(file_path))

    try:
        subprocess.run(
            ["rclone", "copy", f"{remote}{file_path}", local_dir],
            check=True,
            capture_output=True
        )
        return local_path
    except:
        return None

def analyze_pdf_content(file_path):
    """Extract and analyze PDF content"""
    try:
        with open(file_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            text = ""
            for page in reader.pages:
                text += page.extract_text()

            # Analysis
            analysis = {
                "page_count": len(reader.pages),
                "word_count": len(text.split()),
                "contains_tro": "TRO" in text.upper() or "RESTRAINING ORDER" in text.upper(),
                "mentions_plaintiff": "ARIAS" in text.upper(),
                "mentions_defendant": "BIANCHI" in text.upper(),
                "has_dates": bool(re.findall(r'\d{1,2}/\d{1,2}/\d{2,4}', text)),
                "key_phrases": extract_key_phrases(text),
                "summary": text[:500].replace('\n', ' ').strip()
            }
            return analysis
    except Exception as e:
        return {"error": str(e)}

def analyze_image_metadata(file_path):
    """Extract image metadata and context"""
    try:
        # Get basic file info
        stat = os.stat(file_path)

        # Try to extract EXIF data
        analysis = {
            "file_size": stat.st_size,
            "modified_date": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "is_screenshot": "screenshot" in os.path.basename(file_path).lower(),
            "is_photo_evidence": "photo" in os.path.basename(file_path).lower()
        }

        return analysis
    except Exception as e:
        return {"error": str(e)}

def analyze_csv_data(file_path):
    """Analyze CSV data files"""
    try:
        with open(file_path, 'r') as file:
            reader = csv.DictReader(file)
            rows = list(reader)

            analysis = {
                "row_count": len(rows),
                "columns": reader.fieldnames,
                "has_timestamps": any('time' in col.lower() or 'date' in col.lower() for col in reader.fieldnames),
                "has_financial_data": any('amount' in col.lower() or '$' in str(row) for row in rows[:10]),
                "sample_data": rows[:3] if len(rows) > 0 else []
            }
            return analysis
    except Exception as e:
        return {"error": str(e)}

def analyze_text_content(file_path):
    """Analyze text files"""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as file:
            content = file.read()

            analysis = {
                "char_count": len(content),
                "line_count": len(content.split('\n')),
                "word_count": len(content.split()),
                "has_phone_numbers": bool(re.findall(r'\d{3}[-.\s]?\d{3}[-.\s]?\d{4}', content)),
                "has_emails": bool(re.findall(r'[\w\.-]+@[\w\.-]+\.\w+', content)),
                "has_urls": bool(re.findall(r'https?://[^\s]+', content)),
                "key_phrases": extract_key_phrases(content),
                "preview": content[:500]
            }
            return analysis
    except Exception as e:
        return {"error": str(e)}

def extract_key_phrases(text):
    """Extract important phrases from text"""
    key_terms = [
        'harassment', 'abuse', 'threat', 'violence', 'restraining',
        'court', 'judge', 'order', 'violation', 'evidence',
        'witness', 'testimony', 'lease', 'rent', 'payment',
        'damage', 'property', 'police', 'report', 'medical'
    ]

    found_terms = []
    text_lower = text.lower()
    for term in key_terms:
        if term in text_lower:
            found_terms.append(term)

    return found_terms

def analyze_file(remote, file_info):
    """Main analysis function for any file"""
    file_path = file_info.get('Path', file_info.get('Name', ''))
    file_name = os.path.basename(file_path).lower()

    analysis = {
        "file_name": file_name,
        "file_path": file_path,
        "file_size": file_info.get('Size', 0),
        "analyzed_at": datetime.now().isoformat()
    }

    # Determine file type and analyze accordingly
    if file_name.endswith('.pdf'):
        local_file = download_file_from_gdrive(remote, file_path)
        if local_file:
            analysis["content_analysis"] = analyze_pdf_content(local_file)
            analysis["relevance"] = "HIGH" if analysis["content_analysis"].get("contains_tro") else "MEDIUM"
            os.remove(local_file)

    elif file_name.endswith(('.jpg', '.png', '.jpeg')):
        analysis["metadata"] = analyze_image_metadata(file_path)
        analysis["relevance"] = "HIGH" if "screenshot" in file_name else "MEDIUM"

    elif file_name.endswith('.csv'):
        local_file = download_file_from_gdrive(remote, file_path)
        if local_file:
            analysis["data_analysis"] = analyze_csv_data(local_file)
            analysis["relevance"] = "HIGH" if analysis["data_analysis"].get("has_timestamps") else "MEDIUM"
            os.remove(local_file)

    elif file_name.endswith(('.txt', '.md', '.json')):
        local_file = download_file_from_gdrive(remote, file_path)
        if local_file:
            analysis["text_analysis"] = analyze_text_content(local_file)
            analysis["relevance"] = "HIGH" if len(analysis["text_analysis"].get("key_phrases", [])) > 3 else "MEDIUM"
            os.remove(local_file)

    else:
        analysis["relevance"] = "LOW"
        analysis["note"] = "File type not analyzed in detail"

    return analysis

def sync_analyzed_to_notion(token, database_id, file_info, analysis):
    """Sync analyzed file to Notion with content insights"""
    url = "https://api.notion.com/v1/pages"

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
    }

    # Build content summary
    summary_parts = []

    if 'content_analysis' in analysis:
        ca = analysis['content_analysis']
        if ca.get('contains_tro'):
            summary_parts.append("⚠️ Contains TRO references")
        summary_parts.append(f"📄 {ca.get('page_count', 0)} pages")
        if ca.get('key_phrases'):
            summary_parts.append(f"Keywords: {', '.join(ca['key_phrases'][:5])}")

    if 'data_analysis' in analysis:
        da = analysis['data_analysis']
        summary_parts.append(f"📊 {da.get('row_count', 0)} rows")
        if da.get('has_financial_data'):
            summary_parts.append("💰 Financial data")

    if 'text_analysis' in analysis:
        ta = analysis['text_analysis']
        if ta.get('has_phone_numbers'):
            summary_parts.append("📞 Contains phone numbers")
        if ta.get('has_emails'):
            summary_parts.append("✉️ Contains emails")

    content_summary = " | ".join(summary_parts) if summary_parts else "No detailed analysis available"

    properties = {
        "Document Name": {
            "title": [{
                "text": {"content": analysis['file_name'][:100]}
            }]
        },
        "File Path": {
            "rich_text": [{
                "text": {"content": analysis['file_path'][:500]}
            }]
        },
        "Content Summary": {
            "rich_text": [{
                "text": {"content": content_summary[:2000]}
            }]
        },
        "Case Relevance": {
            "select": {"name": analysis.get('relevance', 'UNKNOWN')}
        },
        "Processing Status": {
            "select": {"name": "Analyzed"}
        },
        "Import Date": {
            "date": {"start": analysis['analyzed_at']}
        },
        "File Size (MB)": {
            "number": round(analysis['file_size'] / (1024 * 1024), 3)
        }
    }

    # Add strategic notes for high-relevance items
    if analysis.get('relevance') == 'HIGH':
        strategic_notes = []

        if 'content_analysis' in analysis and analysis['content_analysis'].get('contains_tro'):
            strategic_notes.append("Critical: TRO-related document")

        if 'text_analysis' in analysis:
            phrases = analysis['text_analysis'].get('key_phrases', [])
            if 'threat' in phrases or 'harassment' in phrases:
                strategic_notes.append("Evidence of harassment/threats")

        if strategic_notes:
            properties["Strategic Notes"] = {
                "rich_text": [{
                    "text": {"content": " | ".join(strategic_notes)}
                }]
            }

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
    NOTION_DATABASE_ID = "a1447612bebc41a290d3b840fac7f73d"
    NOTION_TOKEN = os.getenv("NOTION_TOKEN")

    print("=" * 60)
    print("📊 Intelligent Evidence Analysis & Notion Sync")
    print("=" * 60)

    # Get priority files to analyze (PDFs, CSVs, key documents)
    print("🔍 Fetching priority files for analysis...")

    try:
        result = subprocess.run(
            ["rclone", "lsjson", REMOTE, "--include", "*.pdf", "--include", "*.csv", "--include", "*.txt", "--max-depth", "2"],
            capture_output=True,
            text=True,
            check=True
        )
        priority_files = json.loads(result.stdout)
        print(f"✅ Found {len(priority_files)} priority files to analyze")

    except Exception as e:
        print(f"❌ Error: {e}")
        return

    # Analyze and sync files
    success_count = 0
    high_relevance_count = 0

    for i, file_info in enumerate(priority_files[:100], 1):  # Limit to first 100 for testing
        print(f"\n[{i}/{min(100, len(priority_files))}] Analyzing: {file_info.get('Name', 'unknown')[:50]}...")

        # Analyze file
        analysis = analyze_file(REMOTE, file_info)

        if analysis.get('relevance') == 'HIGH':
            high_relevance_count += 1
            print(f"   ⚠️  HIGH RELEVANCE document found!")

        # Sync to Notion with analysis
        result = sync_analyzed_to_notion(NOTION_TOKEN, NOTION_DATABASE_ID, file_info, analysis)

        if result.get('id'):
            success_count += 1
            print(f"   ✅ Synced with analysis")
        else:
            print(f"   ❌ Sync failed: {result.get('message', 'Unknown error')[:50]}")

    # Summary
    print("\n" + "=" * 60)
    print("✅ ANALYSIS COMPLETE")
    print(f"📊 Analyzed and synced: {success_count} files")
    print(f"⚠️  High relevance documents: {high_relevance_count}")
    print(f"🔗 View in Notion: https://www.notion.so/{NOTION_DATABASE_ID}")

if __name__ == "__main__":
    main()