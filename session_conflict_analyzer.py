#!/usr/bin/env python3

"""
Session Conflict Analyzer - Comprehensive Cross-Session Activity Review
Analyzes all Claude sessions to identify project updates, conflicts, and coordination issues
"""

import os
import json
import re
import hashlib
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Set, Tuple, Any
from collections import defaultdict, Counter
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SessionConflictAnalyzer:
    def __init__(self, claude_projects_dir: str = None):
        self.claude_projects_dir = Path(claude_projects_dir or os.path.expanduser("~/.claude/projects"))
        self.sessions = {}
        self.projects = defaultdict(list)
        self.conflicts = []
        self.topics = defaultdict(set)

        # Keywords to identify project types and activities
        self.project_patterns = {
            'legal': ['legal', 'case', 'evidence', 'court', 'tro', 'petition', 'lawsuit', 'arbitration'],
            'chittyos': ['chittyos', 'chittyid', 'chittychat', 'chittychain', 'chitty'],
            'development': ['git', 'commit', 'code', 'function', 'class', 'api', 'debug'],
            'analysis': ['analyze', 'report', 'data', 'timeline', 'contradiction', 'findings'],
            'sync': ['sync', 'upload', 'download', 'rclone', 'backup', 'mirror'],
            'automation': ['hook', 'script', 'cron', 'automation', 'workflow']
        }

        # Activity patterns to track
        self.activity_patterns = {
            'file_creation': [r'created?.*file', r'write.*to', r'new.*file'],
            'file_modification': [r'modified?.*file', r'edit.*file', r'update.*file'],
            'git_operations': [r'git (add|commit|push|pull|clone)', r'committed?', r'staged?'],
            'sync_operations': [r'rclone.*sync', r'upload.*to', r'sync.*with'],
            'analysis_runs': [r'run.*analysis', r'analyze.*data', r'generate.*report'],
            'service_requests': [r'chittyid.*request', r'api.*call', r'service.*endpoint']
        }

    def scan_all_sessions(self) -> Dict[str, Any]:
        """Scan all session files and extract activity data"""

        session_files = list(self.claude_projects_dir.rglob("*.jsonl"))

        logger.info(f"Found {len(session_files)} session files to analyze")

        for session_file in session_files:
            if session_file.stat().st_size > 0:  # Skip empty files
                try:
                    self.analyze_session_file(session_file)
                except Exception as e:
                    logger.warning(f"Error analyzing {session_file}: {e}")

        return {
            'sessions_analyzed': len(self.sessions),
            'projects_identified': len(self.projects),
            'conflicts_found': len(self.conflicts),
            'topics_tracked': len(self.topics)
        }

    def analyze_session_file(self, session_file: Path):
        """Analyze individual session file for project activities"""

        session_id = session_file.stem
        project_path = str(session_file.parent)

        # Extract project name from path
        project_name = self.extract_project_name(project_path)

        session_data = {
            'session_id': session_id,
            'file_path': str(session_file),
            'project_name': project_name,
            'size': session_file.stat().st_size,
            'modified': datetime.fromtimestamp(session_file.stat().st_mtime),
            'activities': defaultdict(list),
            'topics': set(),
            'files_mentioned': set(),
            'git_operations': [],
            'chittyid_activity': {'requests': 0, 'successes': 0, 'errors': 0},
            'project_types': set()
        }

        # Read and analyze session content
        try:
            with open(session_file, 'r', encoding='utf-8', errors='ignore') as f:
                for line_num, line in enumerate(f, 1):
                    if line.strip():
                        try:
                            entry = json.loads(line)
                            self.analyze_session_entry(entry, session_data, line_num)
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            logger.warning(f"Error reading session file {session_file}: {e}")
            return

        # Categorize project types
        self.categorize_project_types(session_data)

        self.sessions[session_id] = session_data
        self.projects[project_name].append(session_id)

    def analyze_session_entry(self, entry: Dict, session_data: Dict, line_num: int):
        """Analyze individual session entry for activities"""

        content = ""

        # Extract content from different entry types
        if entry.get('type') == 'user' and 'message' in entry:
            if isinstance(entry['message'], dict):
                content = entry['message'].get('content', '')
            else:
                content = str(entry['message'])
        elif entry.get('type') == 'assistant' and 'message' in entry:
            if isinstance(entry['message'], dict) and 'content' in entry['message']:
                content_parts = entry['message']['content']
                if isinstance(content_parts, list):
                    content = ' '.join([part.get('text', '') for part in content_parts if isinstance(part, dict)])
                else:
                    content = str(content_parts)
        elif 'content' in entry:
            content = str(entry['content'])

        if not content:
            return

        content_lower = content.lower()

        # Track file operations
        file_patterns = [r'([a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+)', r'`([^`]+)`', r'"([^"]+\.[a-zA-Z0-9]+)"']
        for pattern in file_patterns:
            matches = re.findall(pattern, content)
            session_data['files_mentioned'].update(matches)

        # Track activities
        for activity_type, patterns in self.activity_patterns.items():
            for pattern in patterns:
                if re.search(pattern, content_lower):
                    session_data['activities'][activity_type].append({
                        'line': line_num,
                        'timestamp': entry.get('timestamp'),
                        'content_snippet': content[:200]
                    })

        # Track git operations specifically
        git_matches = re.findall(r'git\s+(\w+)', content_lower)
        session_data['git_operations'].extend(git_matches)

        # Track ChittyID activity
        if 'chittyid' in content_lower:
            if 'request' in content_lower:
                session_data['chittyid_activity']['requests'] += 1
            if 'success' in content_lower or 'received' in content_lower:
                session_data['chittyid_activity']['successes'] += 1
            if 'error' in content_lower or 'failed' in content_lower:
                session_data['chittyid_activity']['errors'] += 1

        # Extract topics (capitalized words and phrases)
        topic_patterns = [
            r'\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\b',  # Capitalized phrases
            r'#(\w+)',  # Hashtags
            r'@(\w+)',  # Mentions
        ]

        for pattern in topic_patterns:
            matches = re.findall(pattern, content)
            session_data['topics'].update(matches)

    def extract_project_name(self, project_path: str) -> str:
        """Extract meaningful project name from path"""

        path_parts = Path(project_path).parts

        # Look for meaningful project identifiers
        for part in reversed(path_parts):
            if part.startswith('-') and len(part) > 5:
                # Extract project name from Claude path format
                return part[1:].replace('-', '/').split('/')[-1]
            elif part not in ['.claude', 'projects', 'Users', 'nb'] and len(part) > 2:
                return part

        return 'unknown'

    def categorize_project_types(self, session_data: Dict):
        """Categorize session by project type based on content"""

        all_content = ' '.join([
            ' '.join(session_data['files_mentioned']),
            ' '.join(session_data['topics']),
            session_data['project_name']
        ]).lower()

        for project_type, keywords in self.project_patterns.items():
            if any(keyword in all_content for keyword in keywords):
                session_data['project_types'].add(project_type)

    def identify_conflicts(self) -> List[Dict]:
        """Identify conflicts between sessions"""

        conflicts = []

        # File modification conflicts
        file_conflicts = self.find_file_conflicts()
        conflicts.extend(file_conflicts)

        # Project overlap conflicts
        project_conflicts = self.find_project_overlap_conflicts()
        conflicts.extend(project_conflicts)

        # Git operation conflicts
        git_conflicts = self.find_git_conflicts()
        conflicts.extend(git_conflicts)

        # ChittyID service conflicts
        chittyid_conflicts = self.find_chittyid_conflicts()
        conflicts.extend(chittyid_conflicts)

        self.conflicts = conflicts
        return conflicts

    def find_file_conflicts(self) -> List[Dict]:
        """Find sessions working on the same files"""

        file_to_sessions = defaultdict(list)

        for session_id, session_data in self.sessions.items():
            for file_name in session_data['files_mentioned']:
                # Filter out common/system files
                if not any(skip in file_name.lower() for skip in ['readme', 'license', '.git', '.ds_store']):
                    file_to_sessions[file_name].append((session_id, session_data))

        conflicts = []
        for file_name, sessions in file_to_sessions.items():
            if len(sessions) > 1:
                # Check if sessions are concurrent (within 24 hours)
                times = [s[1]['modified'] for s in sessions]
                if max(times) - min(times) < timedelta(days=1):
                    conflicts.append({
                        'type': 'file_conflict',
                        'file': file_name,
                        'sessions': [s[0] for s in sessions],
                        'severity': 'medium',
                        'description': f"Multiple sessions working on {file_name}"
                    })

        return conflicts

    def find_project_overlap_conflicts(self) -> List[Dict]:
        """Find sessions with overlapping project activities"""

        conflicts = []

        for project_name, session_ids in self.projects.items():
            if len(session_ids) > 1:
                # Check for concurrent sessions in same project
                sessions_data = [self.sessions[sid] for sid in session_ids]
                recent_sessions = [
                    s for s in sessions_data
                    if s['modified'] > datetime.now() - timedelta(days=7)
                ]

                if len(recent_sessions) > 1:
                    # Check for overlapping activities
                    activity_overlap = self.check_activity_overlap(recent_sessions)
                    if activity_overlap:
                        conflicts.append({
                            'type': 'project_overlap',
                            'project': project_name,
                            'sessions': [s['session_id'] for s in recent_sessions],
                            'overlapping_activities': activity_overlap,
                            'severity': 'high',
                            'description': f"Concurrent work on {project_name} with overlapping activities"
                        })

        return conflicts

    def check_activity_overlap(self, sessions: List[Dict]) -> List[str]:
        """Check for overlapping activities between sessions"""

        activity_counts = Counter()

        for session in sessions:
            for activity_type, activities in session['activities'].items():
                if activities:  # Has activities of this type
                    activity_counts[activity_type] += 1

        # Return activities that appear in multiple sessions
        return [activity for activity, count in activity_counts.items() if count > 1]

    def find_git_conflicts(self) -> List[Dict]:
        """Find potential git operation conflicts"""

        conflicts = []
        git_sessions = []

        for session_id, session_data in self.sessions.items():
            if session_data['git_operations']:
                git_sessions.append((session_id, session_data))

        # Check for concurrent git operations
        for i, (session1_id, session1_data) in enumerate(git_sessions):
            for session2_id, session2_data in git_sessions[i+1:]:
                time_diff = abs((session1_data['modified'] - session2_data['modified']).total_seconds())

                if time_diff < 3600:  # Within 1 hour
                    conflicts.append({
                        'type': 'git_conflict',
                        'sessions': [session1_id, session2_id],
                        'operations': {
                            session1_id: session1_data['git_operations'],
                            session2_id: session2_data['git_operations']
                        },
                        'severity': 'high',
                        'description': "Concurrent git operations detected"
                    })

        return conflicts

    def find_chittyid_conflicts(self) -> List[Dict]:
        """Find ChittyID service usage conflicts"""

        conflicts = []
        chittyid_sessions = []

        for session_id, session_data in self.sessions.items():
            activity = session_data['chittyid_activity']
            if activity['requests'] > 0:
                chittyid_sessions.append((session_id, session_data, activity))

        # Check for sessions with high error rates
        for session_id, session_data, activity in chittyid_sessions:
            if activity['requests'] > 5:
                error_rate = activity['errors'] / activity['requests'] if activity['requests'] > 0 else 0
                if error_rate > 0.5:  # More than 50% errors
                    conflicts.append({
                        'type': 'chittyid_service_issue',
                        'session': session_id,
                        'requests': activity['requests'],
                        'errors': activity['errors'],
                        'error_rate': error_rate,
                        'severity': 'medium',
                        'description': f"High ChittyID service error rate in session {session_id[:8]}"
                    })

        return conflicts

    def generate_report(self) -> str:
        """Generate comprehensive conflict analysis report"""

        report = []
        report.append("# Session Conflict Analysis Report")
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

        # Summary statistics
        report.append("## Summary Statistics")
        report.append(f"- **Sessions Analyzed**: {len(self.sessions)}")
        report.append(f"- **Projects Identified**: {len(self.projects)}")
        report.append(f"- **Conflicts Found**: {len(self.conflicts)}")
        report.append(f"- **Active Sessions (7 days)**: {self.count_recent_sessions(7)}")
        report.append(f"- **Active Sessions (24 hours)**: {self.count_recent_sessions(1)}\n")

        # Project breakdown
        report.append("## Project Activity Breakdown")
        for project_name, session_ids in self.projects.items():
            recent_count = sum(1 for sid in session_ids
                             if self.sessions[sid]['modified'] > datetime.now() - timedelta(days=7))

            # Project types for this project
            project_types = set()
            for sid in session_ids:
                project_types.update(self.sessions[sid]['project_types'])

            report.append(f"### {project_name}")
            report.append(f"- **Total Sessions**: {len(session_ids)}")
            report.append(f"- **Recent Activity**: {recent_count} sessions (7 days)")
            report.append(f"- **Project Types**: {', '.join(project_types) if project_types else 'Unclassified'}")

            # Top files mentioned
            all_files = set()
            for sid in session_ids:
                all_files.update(self.sessions[sid]['files_mentioned'])

            if all_files:
                top_files = sorted(all_files)[:10]
                report.append(f"- **Key Files**: {', '.join(top_files)}")

            report.append("")

        # Conflicts section
        if self.conflicts:
            report.append("## Conflicts and Issues Detected")

            # Group conflicts by severity
            high_severity = [c for c in self.conflicts if c.get('severity') == 'high']
            medium_severity = [c for c in self.conflicts if c.get('severity') == 'medium']

            if high_severity:
                report.append("### 🔴 High Severity Conflicts")
                for conflict in high_severity:
                    report.append(f"- **{conflict['type']}**: {conflict['description']}")
                    if 'sessions' in conflict:
                        sessions_info = [f"{sid[:8]}..." for sid in conflict['sessions']]
                        report.append(f"  - Sessions: {', '.join(sessions_info)}")
                    report.append("")

            if medium_severity:
                report.append("### 🟡 Medium Severity Issues")
                for conflict in medium_severity:
                    report.append(f"- **{conflict['type']}**: {conflict['description']}")
                    if 'sessions' in conflict:
                        sessions_info = [f"{sid[:8]}..." for sid in conflict['sessions']]
                        report.append(f"  - Sessions: {', '.join(sessions_info)}")
                    report.append("")
        else:
            report.append("## ✅ No Major Conflicts Detected")
            report.append("All sessions appear to be working independently without conflicts.\n")

        # ChittyID service status
        report.append("## ChittyID Service Analysis")
        total_requests = sum(s['chittyid_activity']['requests'] for s in self.sessions.values())
        total_errors = sum(s['chittyid_activity']['errors'] for s in self.sessions.values())
        total_successes = sum(s['chittyid_activity']['successes'] for s in self.sessions.values())

        if total_requests > 0:
            success_rate = (total_successes / total_requests) * 100
            error_rate = (total_errors / total_requests) * 100

            report.append(f"- **Total ChittyID Requests**: {total_requests}")
            report.append(f"- **Success Rate**: {success_rate:.1f}%")
            report.append(f"- **Error Rate**: {error_rate:.1f}%")

            if error_rate > 50:
                report.append("- **Status**: ⚠️ High error rate detected - service may be unstable")
            elif error_rate > 20:
                report.append("- **Status**: ⚠️ Moderate error rate - monitor service health")
            else:
                report.append("- **Status**: ✅ Service operating normally")
        else:
            report.append("- **Status**: No ChittyID requests detected")

        report.append("")

        # Recommendations
        report.append("## Recommendations")

        if high_severity:
            report.append("### Immediate Actions Required")
            report.append("- **Coordinate concurrent sessions** working on the same projects")
            report.append("- **Review git operations** to prevent merge conflicts")
            report.append("- **Establish session coordination protocol** for shared resources")
            report.append("")

        if medium_severity:
            report.append("### Monitoring Recommended")
            report.append("- **Monitor ChittyID service health** and retry failed requests")
            report.append("- **Track file modification patterns** to prevent overwrites")
            report.append("- **Review project organization** to reduce overlap")
            report.append("")

        # Session details appendix
        report.append("## Session Details")

        # Sort sessions by most recent first
        sorted_sessions = sorted(
            self.sessions.items(),
            key=lambda x: x[1]['modified'],
            reverse=True
        )

        for session_id, session_data in sorted_sessions[:20]:  # Top 20 most recent
            report.append(f"### {session_id[:16]}...")
            report.append(f"- **Project**: {session_data['project_name']}")
            report.append(f"- **Modified**: {session_data['modified'].strftime('%Y-%m-%d %H:%M:%S')}")
            report.append(f"- **Size**: {session_data['size']:,} bytes")
            report.append(f"- **Project Types**: {', '.join(session_data['project_types'])}")

            # Activity summary
            activities = {k: len(v) for k, v in session_data['activities'].items() if v}
            if activities:
                activity_summary = ', '.join([f"{k}: {v}" for k, v in activities.items()])
                report.append(f"- **Activities**: {activity_summary}")

            # Git operations
            if session_data['git_operations']:
                git_summary = ', '.join(set(session_data['git_operations']))
                report.append(f"- **Git Operations**: {git_summary}")

            # ChittyID activity
            chitty_activity = session_data['chittyid_activity']
            if chitty_activity['requests'] > 0:
                report.append(f"- **ChittyID**: {chitty_activity['requests']} requests, {chitty_activity['successes']} successes, {chitty_activity['errors']} errors")

            report.append("")

        return '\n'.join(report)

    def count_recent_sessions(self, days: int) -> int:
        """Count sessions active within specified days"""
        cutoff = datetime.now() - timedelta(days=days)
        return sum(1 for session_data in self.sessions.values()
                  if session_data['modified'] > cutoff)

    def save_report(self, output_file: str = None):
        """Save conflict analysis report to file"""

        if not output_file:
            output_file = f"session_conflict_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"

        report_content = self.generate_report()

        with open(output_file, 'w') as f:
            f.write(report_content)

        logger.info(f"Conflict analysis report saved to: {output_file}")
        return output_file

def main():
    """Main execution function"""

    print("🔍 Session Conflict Analyzer - Scanning all Claude sessions...")

    analyzer = SessionConflictAnalyzer()

    # Scan all sessions
    stats = analyzer.scan_all_sessions()
    print(f"📊 Scanned {stats['sessions_analyzed']} sessions across {stats['projects_identified']} projects")

    # Identify conflicts
    conflicts = analyzer.identify_conflicts()
    print(f"⚠️  Found {len(conflicts)} potential conflicts")

    # Generate and save report
    report_file = analyzer.save_report()
    print(f"📄 Report saved to: {report_file}")

    # Print summary
    if conflicts:
        high_severity = sum(1 for c in conflicts if c.get('severity') == 'high')
        print(f"\n🔴 High severity conflicts: {high_severity}")
        print(f"🟡 Medium severity issues: {len(conflicts) - high_severity}")
    else:
        print("\n✅ No major conflicts detected")

    return analyzer

if __name__ == "__main__":
    main()