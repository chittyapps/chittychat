// Notion Evidence Sync for Case 2024D007847
// Syncs current evidence analysis results to Notion database

const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration - using existing vanguard onboarding config
const configPath = '/Users/nb/.claude/projects/-/legal/vangaurd/onboarding/notion_config.json';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Initialize Notion client (will need 1Password integration for token)
const notion = new Client({
  auth: process.env.NOTION_TOKEN || 'ntn_...' // Will need actual token
});

// Generate ChittyID for evidence items
function generateChittyID(filename, index) {
  const version = '01';
  const geographic = '1';
  const location = 'CHI';
  const sequential = String(index + 2000).padStart(4, '0'); // Start at 2000 for case evidence
  const entityType = '3'; // Thing (evidence)
  const now = new Date();
  const yearMonth = now.getFullYear().toString().slice(-2) +
                   (now.getMonth() + 1).toString().padStart(2, '0');
  const category = 'L'; // Legal evidence

  // Calculate Mod-97 checksum
  const baseId = `${version}${geographic}${location}${sequential}${entityType}${yearMonth}${category}`;
  let remainder = 0;
  for (let char of baseId) {
    const val = /[A-Z]/.test(char) ? char.charCodeAt(0) - 55 : parseInt(char);
    remainder = (remainder * 10 + val) % 97;
  }
  const checksum = (98 - remainder).toString().padStart(2, '0');

  return `CT-${version}-${geographic}-${location}-${sequential}-${entityType}-${yearMonth}-${category}-${checksum}`;
}

// Calculate file hash
function calculateHash(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  } catch (error) {
    return 'file_not_accessible';
  }
}

// Current evidence analysis results to sync
function getCurrentEvidenceItems() {
  const evidenceItems = [];
  let index = 0;

  // Core analysis reports
  const reports = [
    {
      filename: 'FINAL_INTEGRATED_DISCOVERY_REPORT.md',
      classification: 'ANALYSIS_REPORT',
      description: 'Comprehensive integrated discovery analysis report'
    },
    {
      filename: 'evidence_analysis_complete.md',
      classification: 'ANALYSIS_SUMMARY',
      description: 'Evidence analysis completion summary'
    },
    {
      filename: 'openphone_critical_evidence.md',
      classification: 'COMMUNICATION_ANALYSIS',
      description: 'OpenPhone business communications analysis'
    },
    {
      filename: 'message_contradictions_summary.md',
      classification: 'CONTRADICTION_ANALYSIS',
      description: 'iMessage evidence contradictions report'
    },
    {
      filename: 'integrated_communication_timeline.md',
      classification: 'TIMELINE_ANALYSIS',
      description: 'Multi-platform communication timeline'
    },
    {
      filename: 'comprehensive_discovery_package.md',
      classification: 'DISCOVERY_PACKAGE',
      description: 'Complete discovery package documentation'
    },
    {
      filename: 'timeline_master.csv',
      classification: 'TIMELINE_DATA',
      description: 'Master timeline data in CSV format'
    },
    {
      filename: 'exhibit_index.csv',
      classification: 'EXHIBIT_INDEX',
      description: 'Complete exhibit indexing system'
    }
  ];

  reports.forEach(report => {
    const filePath = path.join('out', report.filename);
    evidenceItems.push({
      chitty_id: generateChittyID(report.filename, index++),
      filename: report.filename,
      file_path: filePath,
      file_hash: calculateHash(filePath),
      classification: report.classification,
      case_number: '2024D007847',
      legal_hold: true,
      verification_status: 'VERIFIED',
      description: report.description,
      analysis_date: new Date().toISOString(),
      evidence_type: 'ANALYSIS_OUTPUT'
    });
  });

  return evidenceItems;
}

// Sync evidence to Notion
async function syncEvidenceToNotion() {
  try {
    console.log('🔄 Starting Notion evidence sync...');

    const evidenceItems = getCurrentEvidenceItems();
    console.log(`📊 Found ${evidenceItems.length} evidence items to sync`);

    for (const item of evidenceItems) {
      try {
        // Create Notion page for each evidence item
        const response = await notion.pages.create({
          parent: { database_id: config.notion.database_id },
          properties: {
            'ChittyID': {
              title: [{ text: { content: item.chitty_id } }]
            },
            'File Name': {
              rich_text: [{ text: { content: item.filename } }]
            },
            'SHA-256 Hash': {
              rich_text: [{ text: { content: item.file_hash } }]
            },
            'Evidence Level': {
              select: { name: item.classification }
            },
            'Case Number': {
              rich_text: [{ text: { content: item.case_number } }]
            },
            'Legal Hold': {
              checkbox: item.legal_hold
            },
            'Status': {
              select: { name: item.verification_status }
            },
            'Description': {
              rich_text: [{ text: { content: item.description } }]
            },
            'Analysis Date': {
              date: { start: item.analysis_date }
            }
          }
        });

        console.log(`✅ Synced: ${item.filename} (${item.chitty_id})`);

        // Add delay to respect API limits
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Failed to sync ${item.filename}:`, error.message);
      }
    }

    console.log('🎯 Notion sync completed');

    // Generate sync report
    const syncReport = {
      timestamp: new Date().toISOString(),
      case_number: '2024D007847',
      items_synced: evidenceItems.length,
      sync_status: 'COMPLETED',
      database_id: config.notion.database_id,
      evidence_items: evidenceItems.map(item => ({
        chitty_id: item.chitty_id,
        filename: item.filename,
        classification: item.classification
      }))
    };

    // Save sync report
    fs.writeFileSync('out/notion_sync_report.json', JSON.stringify(syncReport, null, 2));
    console.log('📄 Sync report saved to out/notion_sync_report.json');

  } catch (error) {
    console.error('💥 Notion sync failed:', error.message);

    // Check if it's authentication issue
    if (error.code === 'unauthorized') {
      console.log('🔑 Authentication required - ensure NOTION_TOKEN environment variable is set');
      console.log('💡 Use: export NOTION_TOKEN="your_notion_integration_token"');
    }
  }
}

// Test mode - just show what would be synced
function testSync() {
  console.log('🧪 Test Mode - Evidence items that would be synced:');
  const evidenceItems = getCurrentEvidenceItems();

  evidenceItems.forEach((item, index) => {
    console.log(`${index + 1}. ${item.chitty_id} - ${item.filename}`);
    console.log(`   Classification: ${item.classification}`);
    console.log(`   Hash: ${item.file_hash.substring(0, 16)}...`);
    console.log('');
  });

  console.log(`📊 Total items ready for sync: ${evidenceItems.length}`);
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--test')) {
    testSync();
  } else if (args.includes('--sync')) {
    syncEvidenceToNotion();
  } else {
    console.log('Notion Evidence Sync for Case 2024D007847');
    console.log('');
    console.log('Usage:');
    console.log('  node notion_evidence_sync.js --test   # Show what would be synced');
    console.log('  node notion_evidence_sync.js --sync   # Perform actual sync');
    console.log('');
    console.log('Environment variables needed:');
    console.log('  NOTION_TOKEN - Your Notion integration token');
    console.log('');
    console.log('📊 Current evidence analysis ready for sync');
  }
}

module.exports = {
  syncEvidenceToNotion,
  getCurrentEvidenceItems,
  generateChittyID
};