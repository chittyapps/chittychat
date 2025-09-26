#!/usr/bin/env python3

"""
Claude Session Analysis - Extract project and topic updates across all sessions
"""

import json
import os
import glob
from datetime import datetime
from pathlib import Path
import re

class ClaudeSessionAnalyzer:
    def __init__(self):
        self.projects_root = "/Users/nb/.claude/projects"
        self.sessions = []
        self.project_activities = {}
        self.conflicts = []

    def scan_sessions(self):
        """Find all active session transcripts"""
        print("🔍 Scanning for Claude session transcripts...")

        # Find all JSONL files excluding backups
        pattern = f"{self.projects_root}/**/**.jsonl"
        all_files = glob.glob(pattern, recursive=True)

        # Filter out backup directories
        active_files = [f for f in all_files if '/backup-' not in f]

        print(f"📊 Found {len(active_files)} active session transcripts")

        # Group by project
        projects = {}
        for file_path in active_files:
            project_match = re.search(r'projects/([^/]+)/', file_path)
            if project_match:
                project_name = project_match.group(1)
                if project_name not in projects:
                    projects[project_name] = []
                projects[project_name].append(file_path)

        print(f"🗂️ Projects identified: {list(projects.keys())}")
        return projects

    def extract_session_summary(self, file_path, max_lines=50):
        """Extract key information from a session transcript"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = []
                for i, line in enumerate(f):
                    if i >= max_lines:  # Limit to avoid processing huge files
                        break
                    try:
                        data = json.loads(line.strip())
                        if data.get('type') == 'user':
                            lines.append(data.get('content', ''))
                        elif data.get('type') == 'assistant':
                            lines.append(data.get('content', ''))
                    except json.JSONDecodeError:
                        continue

                # Extract key topics and activities
                content = ' '.join(lines)

                # Look for project indicators
                indicators = {
                    'legal': ['case', 'evidence', 'TRO', 'petition', 'discovery', 'legal'],
                    'chittyid': ['chittyid', 'ChittyID', 'identity', 'verification'],
                    'chittychat': ['chittychat', 'messaging', 'communication'],
                    'brand': ['brand', 'design', 'logo', 'visual'],
                    'openphone': ['openphone', 'phone', 'calls', 'sms'],
                    'sync': ['sync', 'integration', 'database', 'notion'],
                    'deployment': ['deploy', 'cloudflare', 'workers', 'production']
                }

                topics = []
                for topic, keywords in indicators.items():
                    if any(keyword.lower() in content.lower() for keyword in keywords):
                        topics.append(topic)

                return {
                    'file_path': file_path,
                    'size_kb': os.path.getsize(file_path) // 1024,
                    'modified': datetime.fromtimestamp(os.path.getmtime(file_path)),
                    'topics': topics,
                    'content_preview': content[:500] if content else ''
                }

        except Exception as e:
            print(f"❌ Error processing {file_path}: {e}")
            return None

    def analyze_project_activities(self, projects):
        """Analyze activities across all projects"""
        print("📈 Analyzing project activities...")

        for project_name, session_files in projects.items():
            print(f"\n🗂️ Project: {project_name}")
            project_data = {
                'sessions': [],
                'topics': set(),
                'last_activity': None,
                'total_sessions': len(session_files)
            }

            for session_file in session_files:
                session_summary = self.extract_session_summary(session_file)
                if session_summary:
                    project_data['sessions'].append(session_summary)
                    project_data['topics'].update(session_summary['topics'])

                    if not project_data['last_activity'] or session_summary['modified'] > project_data['last_activity']:
                        project_data['last_activity'] = session_summary['modified']

            # Convert set to list for JSON serialization
            project_data['topics'] = list(project_data['topics'])

            self.project_activities[project_name] = project_data
            print(f"   Sessions: {project_data['total_sessions']}")
            print(f"   Topics: {', '.join(project_data['topics'])}")
            print(f"   Last Activity: {project_data['last_activity']}")

    def identify_conflicts(self):
        """Identify potential conflicts and overlapping work"""
        print("\n🔍 Identifying conflicts and overlapping work...")

        # Topic overlap analysis
        topic_projects = {}
        for project, data in self.project_activities.items():
            for topic in data['topics']:
                if topic not in topic_projects:
                    topic_projects[topic] = []
                topic_projects[topic].append(project)

        # Find topics worked on in multiple projects
        for topic, projects in topic_projects.items():
            if len(projects) > 1:
                self.conflicts.append({
                    'type': 'topic_overlap',
                    'topic': topic,
                    'projects': projects,
                    'risk_level': 'HIGH' if topic in ['legal', 'chittyid'] else 'MEDIUM'
                })

        # Concurrent work analysis (same day activities)
        recent_activities = []
        for project, data in self.project_activities.items():
            if data['last_activity']:
                recent_activities.append({
                    'project': project,
                    'date': data['last_activity'].date(),
                    'topics': data['topics']
                })

        # Group by date
        date_groups = {}
        for activity in recent_activities:
            date_key = activity['date']
            if date_key not in date_groups:
                date_groups[date_key] = []
            date_groups[date_key].append(activity)

        # Find concurrent work on same topics
        for date, activities in date_groups.items():
            if len(activities) > 1:
                for i, act1 in enumerate(activities):
                    for act2 in activities[i+1:]:
                        common_topics = set(act1['topics']) & set(act2['topics'])
                        if common_topics:
                            self.conflicts.append({
                                'type': 'concurrent_work',
                                'date': date.isoformat(),
                                'projects': [act1['project'], act2['project']],
                                'common_topics': list(common_topics),
                                'risk_level': 'HIGH'
                            })

        print(f"⚠️ Found {len(self.conflicts)} potential conflicts")

    def generate_report(self):
        """Generate comprehensive session review report"""
        print("\n📋 Generating comprehensive session review report...")

        report = {
            'analysis_date': datetime.now().isoformat(),
            'summary': {
                'total_projects': len(self.project_activities),
                'total_conflicts': len(self.conflicts),
                'active_topics': list(set(topic for data in self.project_activities.values() for topic in data['topics']))
            },
            'project_activities': self.project_activities,
            'conflicts': self.conflicts,
            'recommendations': []
        }

        # Generate recommendations
        if self.conflicts:
            report['recommendations'].append("🔄 Consolidate overlapping work into single project streams")
            report['recommendations'].append("📋 Establish clear project boundaries and topic ownership")
            report['recommendations'].append("⏰ Coordinate concurrent activities to avoid conflicts")

        # High-priority conflicts
        high_priority = [c for c in self.conflicts if c.get('risk_level') == 'HIGH']
        if high_priority:
            report['recommendations'].append(f"🚨 Address {len(high_priority)} high-priority conflicts immediately")

        # Save report
        report_file = 'out/session_analysis_report.json'
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2, default=str)

        # Generate markdown summary
        md_content = self.generate_markdown_summary(report)
        with open('out/session_analysis_summary.md', 'w') as f:
            f.write(md_content)

        print(f"✅ Reports saved:")
        print(f"   📄 {report_file}")
        print(f"   📝 out/session_analysis_summary.md")

        return report

    def generate_markdown_summary(self, report):
        """Generate markdown summary of session analysis"""
        md = f"""# Claude Session Analysis Report

**Generated:** {report['analysis_date']}

## 📊 Executive Summary

- **Total Projects:** {report['summary']['total_projects']}
- **Active Topics:** {len(report['summary']['active_topics'])}
- **Potential Conflicts:** {report['summary']['total_conflicts']}

## 🗂️ Project Activities

"""

        for project, data in report['project_activities'].items():
            md += f"""### {project}
- **Sessions:** {data['total_sessions']}
- **Topics:** {', '.join(data['topics']) if data['topics'] else 'None identified'}
- **Last Activity:** {data['last_activity']}

"""

        if report['conflicts']:
            md += f"""## ⚠️ Conflicts Identified ({len(report['conflicts'])})

"""
            for i, conflict in enumerate(report['conflicts'], 1):
                md += f"""### {i}. {conflict['type'].replace('_', ' ').title()}
- **Risk Level:** {conflict['risk_level']}
- **Projects:** {', '.join(conflict['projects'])}
"""
                if 'topic' in conflict:
                    md += f"- **Topic:** {conflict['topic']}\n"
                if 'common_topics' in conflict:
                    md += f"- **Common Topics:** {', '.join(conflict['common_topics'])}\n"
                if 'date' in conflict:
                    md += f"- **Date:** {conflict['date']}\n"
                md += "\n"

        if report['recommendations']:
            md += """## 💡 Recommendations

"""
            for rec in report['recommendations']:
                md += f"- {rec}\n"

        return md

    def run_analysis(self):
        """Run complete session analysis"""
        print("🚀 Starting Claude Session Analysis")
        print("=" * 50)

        # Scan sessions
        projects = self.scan_sessions()

        # Extract activities
        self.analyze_project_activities(projects)

        # Identify conflicts
        self.identify_conflicts()

        # Generate report
        report = self.generate_report()

        print("\n✅ Analysis complete!")
        return report

if __name__ == "__main__":
    analyzer = ClaudeSessionAnalyzer()
    analyzer.run_analysis()