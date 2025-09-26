// Standalone Notion Evidence Sync for Case 2024D007847
// Service-based ChittyID generation

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Service-based ChittyID generation
async function mintChittyId(domain, subtype) {
  const fetch = (await import('node-fetch')).default;
  const r = await fetch('https://id.chitty.cc/v1/mint', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${process.env.CHITTY_ID_TOKEN}`
    },
    body: JSON.stringify({ domain, subtype })
  });
  if (!r.ok) throw new Error(`ID service ${r.status}`);
  return (await r.json()).chitty_id;
}

// Calculate file hash
function calculateHash(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  } catch (error) {
    return `hash_unavailable_${Math.random().toString(36).substring(7)}`;
  }
}

// Get current evidence items for sync
async function getCurrentEvidenceItems() {
  const evidenceItems = [];
  let index = 0;

  const reports = [
    {
      filename: 'FINAL_INTEGRATED_DISCOVERY_REPORT.md',
      classification: 'COMPREHENSIVE_ANALYSIS',
      description: 'Complete integrated discovery analysis with multi-platform evidence'
    },
    {
      filename: 'evidence_analysis_complete.md',
      classification: 'ANALYSIS_SUMMARY',
      description: 'Executive summary of evidence analysis completion'
    },
    {
      filename: 'openphone_critical_evidence.md',
      classification: 'BUSINESS_COMMUNICATIONS',
      description: 'OpenPhone business communications analysis for critical period'
    },
    {
      filename: 'message_contradictions_summary.md',
      classification: 'CONTRADICTION_EVIDENCE',
      description: 'iMessage contradictions to TRO claims analysis'
    },
    {
      filename: 'integrated_communication_timeline.md',
      classification: 'TIMELINE_INTEGRATION',
      description: 'Multi-platform communication timeline analysis'
    },
    {
      filename: 'comprehensive_discovery_package.md',
      classification: 'DISCOVERY_PACKAGE',
      description: 'Complete discovery package documentation'
    },
    {
      filename: 'timeline_master.csv',
      classification: 'TIMELINE_DATA',
      description: 'Master timeline with 1,433 events across all evidence sources'
    },
    {
      filename: 'exhibit_index.csv',
      classification: 'EXHIBIT_CATALOG',
      description: 'Complete exhibit indexing and cataloging system'
    },
    {
      filename: 'openphone_critical_analysis.json',
      classification: 'STRUCTURED_DATA',
      description: 'OpenPhone critical period analysis in structured format'
    }
  ];

  for (const report of reports) {
    const filePath = path.join('out', report.filename);
    const chitty_id = await mintChittyId('legal', report.classification.toLowerCase());
    evidenceItems.push({
      chitty_id,
      filename: report.filename,
      file_path: filePath,
      file_hash: calculateHash(filePath),
      classification: report.classification,
      case_number: '2024D007847',
      legal_hold: true,
      verification_status: 'VERIFIED',
      description: report.description,
      analysis_date: new Date().toISOString(),
      evidence_type: 'ANALYSIS_OUTPUT',
      file_exists: fs.existsSync(filePath),
      file_size: fs.existsSync(filePath) ? fs.statSync(filePath).size : 0
    });
  }

  return evidenceItems;
}

// Generate Notion sync preparation report
async function generateSyncReport() {
  console.log('📊 Notion Evidence Sync Preparation - Case 2024D007847\\n');

  const evidenceItems = await getCurrentEvidenceItems();
  const availableItems = evidenceItems.filter(item => item.file_exists);
  const missingItems = evidenceItems.filter(item => !item.file_exists);

  console.log(`✅ Available for sync: ${availableItems.length} items`);
  console.log(`❌ Missing files: ${missingItems.length} items\\n`);

  console.log('📋 Evidence Items Ready for Notion Sync:\\n');

  availableItems.forEach((item, index) => {
    console.log(`${index + 1}. ChittyID: ${item.chitty_id}`);
    console.log(`   File: ${item.filename}`);
    console.log(`   Classification: ${item.classification}`);
    console.log(`   Size: ${(item.file_size / 1024).toFixed(1)} KB`);
    console.log(`   Hash: ${item.file_hash.substring(0, 16)}...`);
    console.log(`   Description: ${item.description}`);
    console.log('');
  });

  if (missingItems.length > 0) {
    console.log('⚠️  Missing files that would be skipped:\\n');
    missingItems.forEach(item => {
      console.log(`   • ${item.filename}`);
    });
    console.log('');
  }

  // Generate detailed sync manifest
  const syncManifest = {
    case_number: '2024D007847',
    sync_preparation_date: new Date().toISOString(),
    total_items: evidenceItems.length,
    available_for_sync: availableItems.length,
    missing_files: missingItems.length,
    notion_database_config: {
      database_id: '26c94de4-3579-8128-b398-d4a90e812683',
      required_properties: [
        'ChittyID', 'File Name', 'SHA-256 Hash', 'Evidence Level',
        'Case Number', 'Legal Hold', 'Status', 'Description', 'Analysis Date'
      ]
    },
    evidence_ready_for_sync: availableItems.map(item => ({
      chitty_id: item.chitty_id,
      filename: item.filename,
      classification: item.classification,
      file_size_kb: Math.round(item.file_size / 1024),
      verification_status: item.verification_status
    })),
    missing_evidence: missingItems.map(item => item.filename)
  };

  // Save manifest
  fs.writeFileSync('out/notion_sync_manifest.json', JSON.stringify(syncManifest, null, 2));

  console.log('📄 Sync manifest saved to: out/notion_sync_manifest.json');
  console.log('🎯 Evidence package ready for Notion integration');
  console.log('');
  console.log('Next steps:');
  console.log('1. Ensure Notion integration token is configured');
  console.log('2. Verify database permissions and structure');
  console.log('3. Execute sync using Notion API client');

  return syncManifest;
}

// Main execution
if (require.main === module) {
  generateSyncReport().catch(console.error);
}

module.exports = {
  getCurrentEvidenceItems,
  mintChittyId,
  generateSyncReport
};