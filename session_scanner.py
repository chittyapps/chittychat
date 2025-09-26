#!/usr/bin/env python3

"""
Claude Session Scanner for Project and Topic Updates
Scans all Claude sessions for project activities and identifies conflicts
"""

import os
import json
import glob
import hashlib
from datetime import datetime
from pathlib import Path
from collections import defaultdict
import click

@click.command()
@click.option('--claude-dir', default='~/.claude', help='Claude directory to scan')
@click.option('--current-project', default='legal/case', help='Current project path')
@click.option('--output-format', type=click.Choice(['text', 'json', 'markdown']), default='text', help='Output format')
@click.option('--scan-depth', default=3, help='Directory depth to scan')
def scan_sessions(claude_dir, current_project, output_format, scan_depth):
    """Scan all Claude sessions for project and topic updates"""

    claude_path = Path(claude_dir).expanduser()

    if not claude_path.exists():
        click.echo(f"❌ Claude directory not found: {claude_path}")
        return

    click.echo(f"🔍 Scanning Claude sessions in: {claude_path}")
    click.echo(f"📂 Current project: {current_project}")

    # Data structures for analysis
    projects = defaultdict(list)
    topics = defaultdict(list)
    recent_activities = []
    conflicts = []

    # Scan for session files
    session_files = []

    # Find various types of session data
    patterns = [
        "**/*.json",
        "**/*.md",
        "**/*session*",
        "**/*project*",
        "**/CLAUDE.md",
        "**/README.md"
    ]

    for pattern in patterns:
        session_files.extend(glob.glob(str(claude_path / pattern), recursive=True))

    # Remove duplicates and sort
    session_files = sorted(list(set(session_files)))

    click.echo(f"📄 Found {len(session_files)} potential session files")

    # Analyze each file
    for file_path in session_files:
        try:
            analyze_file(file_path, projects, topics, recent_activities, current_project)
        except Exception as e:
            # Skip files that can't be read
            continue

    # Identify conflicts
    conflicts = identify_conflicts(projects, topics, current_project)

    # Generate report
    report_data = {
        "scan_timestamp": datetime.now().isoformat(),
        "claude_directory": str(claude_path),
        "current_project": current_project,
        "total_files_scanned": len(session_files),
        "projects_found": dict(projects),
        "topics_found": dict(topics),
        "recent_activities": recent_activities[-20:],  # Last 20 activities
        "conflicts_detected": conflicts,
        "summary": {
            "total_projects": len(projects),
            "total_topics": len(topics),
            "total_conflicts": len(conflicts),
            "active_projects": [p for p in projects.keys() if len(projects[p]) > 1]
        }
    }

    # Output report
    if output_format == 'json':
        click.echo(json.dumps(report_data, indent=2))
    elif output_format == 'markdown':
        generate_markdown_report(report_data)
    else:
        generate_text_report(report_data)

    # Save report
    output_file = f"out/session_analysis_report.{output_format}"
    if output_format == 'json':
        with open(output_file, 'w') as f:
            json.dump(report_data, f, indent=2)
    elif output_format == 'markdown':
        # Already saved in function
        pass
    else:
        with open(output_file, 'w') as f:
            f.write(f"Claude Session Analysis Report\n")
            f.write("=" * 40 + "\n")
            # Add text content here

    click.echo(f"\n📄 Report saved to: {output_file}")

def analyze_file(file_path, projects, topics, activities, current_project):
    """Analyze a single file for project and topic information"""

    file_path = Path(file_path)

    # Skip binary files and very large files
    if file_path.stat().st_size > 10 * 1024 * 1024:  # 10MB limit
        return

    try:
        content = file_path.read_text(encoding='utf-8', errors='ignore')
    except:
        return

    # Extract project information
    if 'project' in file_path.name.lower() or '/projects/' in str(file_path):
        project_name = extract_project_name(file_path, content)
        if project_name:
            projects[project_name].append({
                "file": str(file_path),
                "size": file_path.stat().st_size,
                "modified": file_path.stat().st_mtime,
                "type": get_file_type(file_path)
            })

    # Extract topics
    topics_found = extract_topics(content)
    for topic in topics_found:
        topics[topic].append({
            "file": str(file_path),
            "context": content[:200],  # First 200 chars for context
            "modified": file_path.stat().st_mtime
        })

    # Track recent activities
    if is_recent_activity(file_path):
        activities.append({
            "file": str(file_path),
            "project": extract_project_name(file_path, content),
            "topics": topics_found[:3],  # Top 3 topics
            "modified": file_path.stat().st_mtime,
            "size": file_path.stat().st_size
        })

def extract_project_name(file_path, content):
    """Extract project name from file path or content"""

    path_str = str(file_path)

    # Check for known project patterns
    if '/legal/' in path_str:
        return 'legal-case'
    elif '/chitty' in path_str.lower():
        return 'chittychat'
    elif '/cloudflare/' in path_str:
        return 'cloudflare-integration'
    elif '/ai-coordination/' in path_str:
        return 'ai-coordination'
    elif '/cross-session-sync/' in path_str:
        return 'cross-session-sync'

    # Extract from content
    if 'case_id' in content.lower() or 'arias v. bianchi' in content.lower():
        return 'legal-case'
    elif 'chittychat' in content.lower() or 'chittyos' in content.lower():
        return 'chittychat'
    elif 'evidence' in content.lower() and 'timeline' in content.lower():
        return 'legal-case'

    return None

def extract_topics(content):
    """Extract key topics from content"""

    topics = []
    content_lower = content.lower()

    # Legal topics
    if any(term in content_lower for term in ['evidence', 'discovery', 'tro', 'motion', 'court']):
        topics.append('legal-proceedings')

    # Evidence analysis
    if any(term in content_lower for term in ['timeline', 'contradiction', 'exhibit']):
        topics.append('evidence-analysis')

    # Technical topics
    if any(term in content_lower for term in ['api', 'database', 'server', 'integration']):
        topics.append('technical-integration')

    # Data management
    if any(term in content_lower for term in ['sync', 'notion', 'neon', 'dashboard']):
        topics.append('data-management')

    # Communication analysis
    if any(term in content_lower for term in ['message', 'openphone', 'imessage', 'communication']):
        topics.append('communication-analysis')

    return topics

def identify_conflicts(projects, topics, current_project):
    """Identify potential conflicts between projects"""

    conflicts = []

    # Check for overlapping work
    for project1 in projects:
        for project2 in projects:
            if project1 != project2:
                # Check if projects have similar files or recent activity
                overlap = check_project_overlap(projects[project1], projects[project2])
                if overlap:
                    conflicts.append({
                        "type": "project_overlap",
                        "projects": [project1, project2],
                        "description": f"Projects {project1} and {project2} have overlapping files",
                        "severity": "medium",
                        "details": overlap
                    })

    # Check for topic conflicts
    current_topics = set()
    for project, files in projects.items():
        if current_project in project:
            for file_info in files:
                file_content = ""
                try:
                    file_content = Path(file_info['file']).read_text(encoding='utf-8', errors='ignore')
                except:
                    continue
                current_topics.update(extract_topics(file_content))

    for topic in current_topics:
        other_projects = []
        for project, files in projects.items():
            if current_project not in project:
                for file_info in files:
                    try:
                        file_content = Path(file_info['file']).read_text(encoding='utf-8', errors='ignore')
                        if topic in extract_topics(file_content):
                            other_projects.append(project)
                            break
                    except:
                        continue

        if other_projects:
            conflicts.append({
                "type": "topic_conflict",
                "topic": topic,
                "current_project": current_project,
                "other_projects": other_projects,
                "description": f"Topic '{topic}' being worked on in multiple projects",
                "severity": "low"
            })

    return conflicts

def check_project_overlap(files1, files2):
    """Check if two project file lists have overlap"""

    # Check for similar file names or recent modifications
    overlap = []

    for f1 in files1:
        for f2 in files2:
            # Check if files are similar
            if Path(f1['file']).name == Path(f2['file']).name:
                overlap.append({
                    "file1": f1['file'],
                    "file2": f2['file'],
                    "reason": "same_filename"
                })

    return overlap

def is_recent_activity(file_path):
    """Check if file represents recent activity"""

    # Files modified in last 7 days
    import time
    week_ago = time.time() - (7 * 24 * 60 * 60)
    return file_path.stat().st_mtime > week_ago

def get_file_type(file_path):
    """Get file type description"""

    suffix = file_path.suffix.lower()

    if suffix == '.md':
        return 'markdown'
    elif suffix == '.json':
        return 'json_data'
    elif suffix == '.py':
        return 'python_script'
    elif suffix == '.csv':
        return 'csv_data'
    else:
        return 'other'

def generate_text_report(data):
    """Generate text format report"""

    click.echo(f"\n" + "="*60)
    click.echo(f"📋 CLAUDE SESSION ANALYSIS REPORT")
    click.echo(f"📅 Generated: {data['scan_timestamp'][:19]}")
    click.echo(f"📂 Claude Directory: {data['claude_directory']}")
    click.echo(f"🎯 Current Project: {data['current_project']}")
    click.echo(f"="*60)

    # Summary
    summary = data['summary']
    click.echo(f"\n📊 SUMMARY:")
    click.echo(f"   • Files Scanned: {data['total_files_scanned']}")
    click.echo(f"   • Projects Found: {summary['total_projects']}")
    click.echo(f"   • Topics Identified: {summary['total_topics']}")
    click.echo(f"   • Conflicts Detected: {summary['total_conflicts']}")

    # Active Projects
    if summary['active_projects']:
        click.echo(f"\n🚀 ACTIVE PROJECTS:")
        for project in summary['active_projects']:
            file_count = len(data['projects_found'][project])
            click.echo(f"   • {project}: {file_count} files")

    # Recent Activities
    if data['recent_activities']:
        click.echo(f"\n⏱️  RECENT ACTIVITIES:")
        for activity in data['recent_activities'][-10:]:  # Last 10
            project = activity.get('project', 'unknown')
            file_name = Path(activity['file']).name
            topics = ', '.join(activity.get('topics', [])[:2])
            click.echo(f"   • {project}: {file_name} ({topics})")

    # Conflicts
    if data['conflicts_detected']:
        click.echo(f"\n⚠️  CONFLICTS DETECTED:")
        for conflict in data['conflicts_detected']:
            severity = conflict.get('severity', 'unknown')
            desc = conflict.get('description', 'No description')
            click.echo(f"   • [{severity.upper()}] {desc}")

    # Recommendations
    click.echo(f"\n💡 RECOMMENDATIONS:")
    if data['conflicts_detected']:
        click.echo(f"   • Review {len(data['conflicts_detected'])} conflicts for coordination")
    if summary['active_projects']:
        click.echo(f"   • {len(summary['active_projects'])} projects have recent activity")
    click.echo(f"   • Current legal case project appears active and isolated")

def generate_markdown_report(data):
    """Generate markdown format report"""

    markdown = f"""# Claude Session Analysis Report

**Generated:** {data['scan_timestamp'][:19]}
**Claude Directory:** `{data['claude_directory']}`
**Current Project:** `{data['current_project']}`

---

## 📊 Summary

- **Files Scanned:** {data['total_files_scanned']}
- **Projects Found:** {data['summary']['total_projects']}
- **Topics Identified:** {data['summary']['total_topics']}
- **Conflicts Detected:** {data['summary']['total_conflicts']}

## 🚀 Active Projects

"""

    for project in data['summary']['active_projects']:
        file_count = len(data['projects_found'][project])
        markdown += f"- **{project}:** {file_count} files\n"

    if data['conflicts_detected']:
        markdown += "\n## ⚠️ Conflicts Detected\n\n"
        for conflict in data['conflicts_detected']:
            severity = conflict.get('severity', 'unknown')
            desc = conflict.get('description', 'No description')
            markdown += f"- **[{severity.upper()}]** {desc}\n"

    markdown += "\n## 💡 Recommendations\n\n"
    if data['conflicts_detected']:
        markdown += f"- Review {len(data['conflicts_detected'])} conflicts for coordination\n"
    markdown += "- Continue current legal case work with minimal conflicts\n"
    markdown += "- Monitor cross-project topic overlap\n"

    with open("out/session_analysis_report.md", "w") as f:
        f.write(markdown)

if __name__ == '__main__':
    scan_sessions()