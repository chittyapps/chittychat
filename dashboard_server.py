#!/usr/bin/env python3

"""
Evidence Dashboard Server
Serves evidence data from CSV files or Neon database
"""

import json
import os
from pathlib import Path
from datetime import datetime
import pandas as pd
from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import click

app = Flask(__name__)
CORS(app)

# Global data storage
timeline_data = None
exhibit_data = None
data_source = "csv"  # or "neon"

def load_csv_data():
    """Load data from CSV files"""
    global timeline_data, exhibit_data

    try:
        # Load timeline data
        timeline_path = Path("out/timeline_master.csv")
        if timeline_path.exists():
            timeline_data = pd.read_csv(timeline_path)
            # Convert timestamp to ISO format for JavaScript
            if 'timestamp' in timeline_data.columns:
                timeline_data['timestamp'] = pd.to_datetime(timeline_data['timestamp']).dt.strftime('%Y-%m-%dT%H:%M:%S')
            print(f"✅ Loaded {len(timeline_data)} timeline items")
        else:
            print(f"❌ Timeline file not found: {timeline_path}")
            timeline_data = pd.DataFrame()

        # Load exhibit data
        exhibit_path = Path("out/exhibit_index.csv")
        if exhibit_path.exists():
            exhibit_data = pd.read_csv(exhibit_path)
            print(f"✅ Loaded {len(exhibit_data)} exhibit items")
        else:
            print("⚠️  Exhibit file not found")
            exhibit_data = pd.DataFrame()

    except Exception as e:
        print(f"❌ Error loading CSV data: {e}")
        timeline_data = pd.DataFrame()
        exhibit_data = pd.DataFrame()

def load_neon_data(connection_string=None):
    """Load data from Neon database"""
    global timeline_data, exhibit_data

    # Use environment variable if no connection string provided
    if not connection_string:
        connection_string = os.environ.get('NEON_DATABASE_URL')

    if not connection_string:
        print("❌ No Neon database connection string provided")
        return False

    try:
        import psycopg2
        import pandas as pd

        conn = psycopg2.connect(connection_string)

        # Load timeline data
        timeline_query = """
        SELECT * FROM evidence_timeline
        WHERE case_id = '2024D007847'
        ORDER BY timestamp DESC
        """
        timeline_data = pd.read_sql(timeline_query, conn)

        # Load exhibit data
        exhibit_query = """
        SELECT * FROM evidence_exhibits
        WHERE case_id = '2024D007847'
        ORDER BY exhibit_id
        """
        exhibit_data = pd.read_sql(exhibit_query, conn)

        conn.close()
        print(f"✅ Loaded {len(timeline_data)} timeline items from Neon")
        print(f"✅ Loaded {len(exhibit_data)} exhibit items from Neon")
        return True

    except ImportError:
        print("❌ psycopg2 not installed. Run: pip install psycopg2-binary")
        return False
    except Exception as e:
        print(f"❌ Error connecting to Neon: {e}")
        return False

@app.route('/')
def serve_dashboard():
    """Serve the main dashboard HTML"""
    return send_from_directory('.', 'evidence_dashboard.html')

@app.route('/api/timeline')
def get_timeline():
    """Get timeline data"""
    if timeline_data is None or timeline_data.empty:
        return jsonify({"error": "No timeline data available"}), 404

    # Apply filters if provided
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    event_type = request.args.get('type')
    source = request.args.get('source')

    filtered_data = timeline_data.copy()

    if start_date:
        filtered_data = filtered_data[filtered_data['timestamp'] >= start_date]
    if end_date:
        filtered_data = filtered_data[filtered_data['timestamp'] <= end_date]
    if event_type and event_type != 'all':
        filtered_data = filtered_data[filtered_data['type'] == event_type]
    if source and source != 'all':
        filtered_data = filtered_data[filtered_data['source'].str.contains(source, na=False)]

    return jsonify(filtered_data.to_dict(orient='records'))

@app.route('/api/exhibits')
def get_exhibits():
    """Get exhibit data"""
    if exhibit_data is None or exhibit_data.empty:
        return jsonify({"error": "No exhibit data available"}), 404

    return jsonify(exhibit_data.to_dict(orient='records'))

@app.route('/api/statistics')
def get_statistics():
    """Get dashboard statistics"""
    stats = {
        "total_evidence": len(timeline_data) if timeline_data is not None else 0,
        "total_exhibits": len(exhibit_data) if exhibit_data is not None else 0,
        "data_source": data_source,
        "last_updated": datetime.now().isoformat()
    }

    if timeline_data is not None and not timeline_data.empty:
        # Calculate additional statistics
        stats["unique_sources"] = timeline_data['source'].nunique() if 'source' in timeline_data.columns else 0
        stats["event_types"] = timeline_data['type'].value_counts().to_dict() if 'type' in timeline_data.columns else {}

        # Calculate timeline span
        if 'timestamp' in timeline_data.columns:
            dates = pd.to_datetime(timeline_data['timestamp'])
            stats["timeline_start"] = dates.min().isoformat()
            stats["timeline_end"] = dates.max().isoformat()
            stats["timeline_days"] = (dates.max() - dates.min()).days

    return jsonify(stats)

@app.route('/api/reload')
def reload_data():
    """Reload data from source"""
    if data_source == "csv":
        load_csv_data()
    else:
        load_neon_data()

    return jsonify({
        "status": "success",
        "message": f"Data reloaded from {data_source}",
        "items": len(timeline_data) if timeline_data is not None else 0
    })

@click.command()
@click.option('--port', default=8080, help='Port to run server on')
@click.option('--source', type=click.Choice(['csv', 'neon']), default='csv', help='Data source to use')
@click.option('--neon-url', help='Neon database connection string')
@click.option('--debug', is_flag=True, help='Run in debug mode')
def run_server(port, source, neon_url, debug):
    """Run the evidence dashboard server"""
    global data_source
    data_source = source

    print(f"🚀 Starting Evidence Dashboard Server")
    print(f"📊 Data source: {source}")

    # Load initial data
    if source == "csv":
        load_csv_data()
    else:
        if not load_neon_data(neon_url):
            print("⚠️  Falling back to CSV data")
            data_source = "csv"
            load_csv_data()

    print(f"🌐 Dashboard available at: http://localhost:{port}")
    print(f"📡 API endpoints:")
    print(f"   • http://localhost:{port}/api/timeline")
    print(f"   • http://localhost:{port}/api/exhibits")
    print(f"   • http://localhost:{port}/api/statistics")
    print(f"   • http://localhost:{port}/api/reload")

    app.run(port=port, debug=debug)

if __name__ == '__main__':
    run_server()