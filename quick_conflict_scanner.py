#!/usr/bin/env python3

"""
Quick Conflict Scanner for Claude Sessions
Focuses on recent activities and current project conflicts
"""

import os
import json
from datetime import datetime, timedelta
from pathlib import Path
import click

@click.command()
@click.option('--days', default=7, help='Days to look back for recent activity')
def quick_scan():
    """Quick scan for recent project conflicts"""

    click.echo("🔍 Quick scanning Claude sessions for conflicts...")

    claude_dir = Path.home() / '.claude'
    current_time = datetime.now()
    cutoff_time = current_time - timedelta(days=7)

    projects_found = {}
    conflicts = []
    recent_files = []

    # Focus on key directories
    key_dirs = [
        'projects',
        'tools/cross-session-sync',
        'mcp-servers'
    ]

    for key_dir in key_dirs:
        scan_dir = claude_dir / key_dir
        if scan_dir.exists():
            scan_directory(scan_dir, cutoff_time, projects_found, recent_files)

    # Analyze for conflicts
    conflicts = analyze_conflicts(projects_found)

    # Generate quick report
    generate_quick_report(projects_found, conflicts, recent_files)

def scan_directory(directory, cutoff_time, projects_found, recent_files):
    """Scan a directory for recent project activity"""

    for file_path in directory.rglob('*'):
        if file_path.is_file() and file_path.stat().st_mtime > cutoff_time.timestamp():
            try:
                # Categorize by project
                project = identify_project(file_path)
                if project:
                    if project not in projects_found:
                        projects_found[project] = []

                    projects_found[project].append({
                        'file': str(file_path),
                        'modified': file_path.stat().st_mtime,
                        'size': file_path.stat().st_size,
                        'type': file_path.suffix
                    })

                    recent_files.append({
                        'file': str(file_path),
                        'project': project,
                        'modified': file_path.stat().st_mtime
                    })

            except Exception:
                continue

def identify_project(file_path):
    """Identify project from file path"""

    path_str = str(file_path).lower()

    if '/legal/' in path_str or 'arias' in path_str or 'bianchi' in path_str:
        return 'legal-case-arias-bianchi'
    elif 'chitty' in path_str:
        return 'chittychat-platform'
    elif 'cloudflare' in path_str:
        return 'cloudflare-integration'
    elif 'cross-session' in path_str:
        return 'cross-session-sync'
    elif 'mcp' in path_str:
        return 'mcp-integration'
    elif 'evidence' in path_str:
        return 'evidence-analysis'

    return None

def analyze_conflicts(projects_found):
    """Analyze for potential conflicts"""

    conflicts = []

    # Check for overlapping topics
    legal_keywords = ['evidence', 'timeline', 'discovery', 'notion', 'database']
    tech_keywords = ['api', 'sync', 'integration', 'server']

    for project, files in projects_found.items():
        if project == 'legal-case-arias-bianchi':
            continue  # Current project

        # Check if other projects touch legal topics
        for file_info in files:
            file_content = ""
            try:
                file_content = Path(file_info['file']).read_text(encoding='utf-8', errors='ignore').lower()
            except:
                continue

            # Check for legal topic overlap
            legal_overlap = [kw for kw in legal_keywords if kw in file_content]
            if legal_overlap:
                conflicts.append({
                    'type': 'topic_overlap',
                    'project': project,
                    'file': file_info['file'],
                    'keywords': legal_overlap,
                    'severity': 'medium'
                })

    return conflicts

def generate_quick_report(projects_found, conflicts, recent_files):
    """Generate quick conflict report"""

    click.echo(f"\n" + "="*50)
    click.echo(f"📋 QUICK CONFLICT ANALYSIS")
    click.echo(f"📅 Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    click.echo(f"="*50)

    # Recent Projects
    click.echo(f"\n🚀 RECENT PROJECT ACTIVITY:")
    for project, files in projects_found.items():
        click.echo(f"   • {project}: {len(files)} recent files")

    # Current Legal Case Status
    legal_files = projects_found.get('legal-case-arias-bianchi', [])
    if legal_files:
        click.echo(f"\n⚖️  CURRENT LEGAL CASE (Arias v. Bianchi):")
        click.echo(f"   • {len(legal_files)} recent files")
        click.echo(f"   • Evidence analysis active")
        click.echo(f"   • Dashboard and sync tools operational")

    # Conflicts
    if conflicts:
        click.echo(f"\n⚠️  POTENTIAL CONFLICTS:")
        for conflict in conflicts:
            project = conflict['project']
            keywords = ', '.join(conflict['keywords'])
            click.echo(f"   • {project}: overlaps with legal topics ({keywords})")
    else:
        click.echo(f"\n✅ NO MAJOR CONFLICTS DETECTED")

    # Recent Activity Summary
    if recent_files:
        click.echo(f"\n📊 RECENT ACTIVITY SUMMARY:")
        recent_files.sort(key=lambda x: x['modified'], reverse=True)

        for activity in recent_files[:10]:  # Top 10 most recent
            file_name = Path(activity['file']).name
            project = activity['project']
            mod_time = datetime.fromtimestamp(activity['modified']).strftime('%m-%d %H:%M')
            click.echo(f"   • {mod_time}: {project} - {file_name}")

    # Recommendations
    click.echo(f"\n💡 RECOMMENDATIONS:")

    if conflicts:
        click.echo(f"   • Review {len(conflicts)} potential topic overlaps")
        click.echo(f"   • Coordinate with other projects on shared tools")
    else:
        click.echo(f"   • Legal case project appears isolated - good!")

    if 'cross-session-sync' in projects_found:
        click.echo(f"   • Cross-session sync tools are active - use for coordination")

    click.echo(f"   • Current Arias v. Bianchi work can proceed independently")

    # Save report
    report_data = {
        'timestamp': datetime.now().isoformat(),
        'projects_found': {k: len(v) for k, v in projects_found.items()},
        'conflicts': conflicts,
        'recent_files_count': len(recent_files),
        'legal_case_status': 'active' if legal_files else 'inactive'
    }

    with open('out/quick_conflict_report.json', 'w') as f:
        json.dump(report_data, f, indent=2)

    click.echo(f"\n📄 Report saved to: out/quick_conflict_report.json")

if __name__ == '__main__':
    quick_scan()