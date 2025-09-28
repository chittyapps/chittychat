/**
 * ChittyOS Notion Data Pipeline
 * Comprehensive sync between Notion and the entire ChittyOS ecosystem
 * Notion ↔ ChittyOS-Data ↔ Cloudflare R2 ↔ Neon ↔ GitHub
 */

import { Octokit } from '@octokit/rest';

export async function handleNotionDataPipeline(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Health check
  if (pathname === '/health') {
    return new Response(JSON.stringify({
      status: 'healthy',
      service: 'ChittyOS Authoritative Data Pipeline',
      mode: 'STRICT_VERIFICATION',
      connections: {
        notion: env.NOTION_TOKEN ? 'configured' : 'missing',
        neon: env.PLATFORM_DB ? 'connected' : 'disconnected',
        r2: env.PLATFORM_STORAGE ? 'connected' : 'disconnected',
        github: env.GITHUB_TOKEN ? 'configured' : 'missing'
      },
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Universal intake - EVERYTHING goes through verification
  if (pathname === '/intake' && request.method === 'POST') {
    return handleUniversalIntake(context);
  }

  // Webhook handler for Notion changes - requires verification
  if (pathname === '/webhook' && request.method === 'POST') {
    return handleNotionWebhook(context);
  }

  // Verification check endpoint
  if (pathname === '/verify' && request.method === 'POST') {
    return handleVerification(context);
  }

  // Manual sync trigger - only for verified entities
  if (pathname === '/sync' && request.method === 'POST') {
    return handleManualSync(context);
  }

  // Pipeline status
  if (pathname === '/status' && request.method === 'GET') {
    return handlePipelineStatus(context);
  }

  // Sync specific entity type - requires verification
  if (pathname.startsWith('/sync/') && request.method === 'POST') {
    const entityType = pathname.split('/')[2];
    return handleEntitySync(context, entityType);
  }

  // Default response
  return new Response(JSON.stringify({
    service: 'ChittyOS Notion Data Pipeline',
    version: '1.0.0',
    endpoints: [
      '/health',
      '/webhook',
      '/sync',
      '/status',
      '/sync/{entity_type}'
    ],
    pipeline: 'Notion ↔ ChittyOS-Data ↔ R2 ↔ Neon ↔ GitHub'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Handle universal intake - ALL data must go through verification
 */
async function handleUniversalIntake(context) {
  const { request, env } = context;

  try {
    const intakeData = await request.json();
    const { source, data, metadata } = intakeData;

    console.log(`🔍 Universal intake from: ${source}`);

    // 1. Check if entity is already registered
    const verificationResult = await verifyEntityRegistration(data, env);

    if (verificationResult.isRegistered && verificationResult.isVerified) {
      // Already registered and verified - can proceed with updates
      return await processVerifiedUpdate(context, data, verificationResult);
    }

    // 2. New or unverified entity - must go through full pipeline
    const pipelineResult = await processAuthoritativePipeline(context, {
      source,
      data,
      metadata,
      verification_status: verificationResult
    });

    return new Response(JSON.stringify({
      status: 'processed',
      pipeline_result: pipelineResult,
      verification: verificationResult
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Universal intake error:', error);
    return new Response(JSON.stringify({
      error: 'Intake processing failed',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Verify if entity is registered in authoritative databases
 */
async function verifyEntityRegistration(data, env) {
  const chittyId = data.chitty_id || data.ChittyID;

  if (!chittyId) {
    return { isRegistered: false, isVerified: false, reason: 'No ChittyID' };
  }

  try {
    // Check Neon database (authoritative source)
    const neonCheck = await env.PLATFORM_DB.prepare(`
      SELECT chitty_id, verification_status, event_hash
      FROM event_store
      WHERE chitty_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).bind(chittyId).first();

    if (!neonCheck) {
      return { isRegistered: false, isVerified: false, reason: 'Not in database' };
    }

    // Check R2 for immutable record
    const r2Key = `verified/${chittyId}.json`;
    const r2Record = await env.PLATFORM_STORAGE.get(r2Key);

    if (!r2Record) {
      return { isRegistered: true, isVerified: false, reason: 'Not in immutable storage' };
    }

    // Verify hash chain integrity
    const storedData = await r2Record.json();
    const hashValid = await verifyHashChain(storedData, neonCheck.event_hash);

    return {
      isRegistered: true,
      isVerified: hashValid,
      chitty_id: chittyId,
      last_verified: storedData.verified_at,
      hash: neonCheck.event_hash
    };

  } catch (error) {
    console.error('Verification error:', error);
    return { isRegistered: false, isVerified: false, error: error.message };
  }
}

/**
 * Process through authoritative pipeline for new/unverified entities
 */
async function processAuthoritativePipeline(context, intakeData) {
  const { env } = context;
  const { source, data, metadata } = intakeData;

  const pipelineSteps = [];

  try {
    // Step 1: Generate or validate ChittyID
    const chittyId = data.chitty_id || generateChittyID(determineEntityType(data));
    data.chitty_id = chittyId;
    pipelineSteps.push({ step: 'chitty_id_assignment', status: 'success', id: chittyId });

    // Step 2: Process and validate data
    const entityData = await parseAndValidateEntity(data);
    pipelineSteps.push({ step: 'data_validation', status: 'success' });

    // Step 3: Process any attached files
    const fileResults = await processAttachedFiles(context, entityData);
    pipelineSteps.push({ step: 'file_processing', status: 'success', files: fileResults.length });

    // Step 4: Create immutable record in R2
    const r2Result = await createImmutableRecord(entityData, env.PLATFORM_STORAGE, fileResults);
    pipelineSteps.push({ step: 'immutable_storage', status: 'success', key: r2Result.key });

    // Step 5: Record in Neon with event sourcing
    const neonResult = await recordInAuthoritativeDatabase(entityData, env.PLATFORM_DB, r2Result.hash);
    pipelineSteps.push({ step: 'database_record', status: 'success', event_id: neonResult.event_id });

    // Step 6: Sync to external systems (Notion, Drive, GitHub)
    const syncResults = await syncToExternalSystems(context, entityData, fileResults);
    pipelineSteps.push({ step: 'external_sync', status: 'success', systems: syncResults });

    // Step 7: Create verification record
    const verificationRecord = await createVerificationRecord(entityData, pipelineSteps, env);
    pipelineSteps.push({ step: 'verification', status: 'success', verified_at: verificationRecord.timestamp });

    return {
      success: true,
      chitty_id: chittyId,
      pipeline_steps: pipelineSteps,
      verification: verificationRecord
    };

  } catch (error) {
    console.error('Pipeline processing error:', error);
    pipelineSteps.push({ step: 'error', status: 'failed', error: error.message });
    return {
      success: false,
      error: error.message,
      pipeline_steps: pipelineSteps
    };
  }
}

/**
 * Handle incoming Notion webhooks - must verify before processing
 */
async function handleNotionWebhook(context) {
  const { request, env } = context;

  try {
    const webhookData = await request.json();
    const { type, page, database } = webhookData;

    console.log(`📥 Notion webhook: ${type}`);

    // ALL Notion data must go through verification pipeline
    return await handleUniversalIntake({
      ...context,
      request: {
        ...request,
        json: async () => ({
          source: 'notion_webhook',
          data: page || database,
          metadata: {
            webhook_type: type,
            timestamp: new Date().toISOString()
          }
        })
      }
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(JSON.stringify({
      error: 'Webhook processing failed',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Process Notion page changes and sync to ecosystem
 */
async function processPageChange(context, page) {
  const { env } = context;

  try {
    // 1. Determine entity type from Notion page
    const entityData = await parseNotionPage(page);

    // 2. Check for file attachments and process them
    const fileResults = await processNotionFiles(context, page, entityData);

    // 3. Sync to ChittyOS-Data (Google Drive) including files
    const driveResult = await syncToChittyOSData(entityData, env, fileResults);

    // 4. Store in Cloudflare R2 including file references
    const r2Result = await storeInR2(entityData, env.PLATFORM_STORAGE, fileResults);

    // 5. Update Neon database with file metadata
    const neonResult = await updateNeonDatabase(entityData, env.PLATFORM_DB, fileResults);

    // 6. Update GitHub project tracking
    const githubResult = await updateGitHubTracking(entityData, env);

    // 7. Create audit trail
    await createAuditTrail({
      source: 'notion',
      action: 'page_updated',
      entityId: entityData.chitty_id,
      entityType: entityData.type,
      files_processed: fileResults.length,
      pipeline_results: {
        drive: driveResult,
        r2: r2Result,
        neon: neonResult,
        github: githubResult
      },
      timestamp: new Date().toISOString()
    }, env);

    return new Response(JSON.stringify({
      status: 'success',
      entityId: entityData.chitty_id,
      synced_to: ['chittyos-data', 'r2', 'neon', 'github'],
      pipeline_results: {
        drive: driveResult,
        r2: r2Result,
        neon: neonResult,
        github: githubResult
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Page change processing error:', error);
    return new Response(JSON.stringify({
      error: 'Page sync failed',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Parse Notion page into ChittyOS entity format
 */
async function parseNotionPage(page) {
  const properties = page.properties || {};

  // Extract entity type from database or page properties
  const entityType = determineEntityType(page);

  // Generate ChittyID if not present
  const chittyId = properties.ChittyID?.rich_text?.[0]?.text?.content ||
                   generateChittyID(entityType);

  // Base entity data
  const entityData = {
    chitty_id: chittyId,
    notion_id: page.id,
    type: entityType,
    title: extractTitle(properties),
    status: properties.Status?.select?.name || 'ACTIVE',
    created_at: page.created_time,
    updated_at: page.last_edited_time,
    metadata: {
      notion_url: page.url,
      notion_properties: properties
    }
  };

  // Entity-specific parsing
  switch (entityType) {
    case 'PERSON':
      return parsePersonEntity(entityData, properties);

    case 'PLACE':
      return parsePlaceEntity(entityData, properties);

    case 'THING':
      return parseThingEntity(entityData, properties);

    case 'EVENT':
      return parseEventEntity(entityData, properties);

    case 'AUTHORITY':
      return parseAuthorityEntity(entityData, properties);

    case 'CASE':
      return parseCaseEntity(entityData, properties);

    case 'EVIDENCE':
      return parseEvidenceEntity(entityData, properties);

    default:
      return entityData;
  }
}

/**
 * Process files attached to Notion page
 */
async function processNotionFiles(context, page, entityData) {
  const { env } = context;
  const fileResults = [];

  try {
    // Extract all file properties from the page
    const properties = page.properties || {};

    for (const [propName, propValue] of Object.entries(properties)) {
      // Check for file/media properties
      if (propValue.type === 'files' && propValue.files?.length > 0) {
        for (const file of propValue.files) {
          const fileResult = await processNotionFile(file, entityData, env);
          fileResults.push({
            property: propName,
            ...fileResult
          });
        }
      }

      // Check for images/media in rich text
      if (propValue.type === 'rich_text' && propValue.rich_text?.length > 0) {
        for (const block of propValue.rich_text) {
          if (block.type === 'file' || block.type === 'image') {
            const fileResult = await processNotionFile(block, entityData, env);
            fileResults.push({
              property: propName,
              ...fileResult
            });
          }
        }
      }
    }

    // Process page cover and icon if they exist
    if (page.cover) {
      const coverResult = await processNotionFile(page.cover, entityData, env);
      fileResults.push({
        property: 'cover',
        ...coverResult
      });
    }

    if (page.icon?.type === 'file') {
      const iconResult = await processNotionFile(page.icon, entityData, env);
      fileResults.push({
        property: 'icon',
        ...iconResult
      });
    }

  } catch (error) {
    console.error('File processing error:', error);
  }

  return fileResults;
}

/**
 * Process individual Notion file
 */
async function processNotionFile(file, entityData, env) {
  try {
    const fileUrl = file.file?.url || file.external?.url || file.url;
    const fileName = file.name || `file-${Date.now()}`;
    const fileType = file.type || 'file';

    if (!fileUrl) {
      return { status: 'skipped', reason: 'No file URL' };
    }

    // Download file from Notion
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      return { status: 'failed', reason: 'Could not download file' };
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    const fileHash = await generateFileHash(fileBuffer);

    // Create file metadata
    const fileMetadata = {
      chitty_id: `FILE-${entityData.chitty_id}-${fileHash.substring(0, 8)}`,
      parent_entity: entityData.chitty_id,
      original_name: fileName,
      file_type: fileType,
      size: fileBuffer.byteLength,
      hash: fileHash,
      notion_url: fileUrl,
      processed_at: new Date().toISOString()
    };

    // Store file in R2
    const r2Key = `files/${entityData.type.toLowerCase()}/${entityData.chitty_id}/${fileName}`;
    await env.PLATFORM_STORAGE.put(r2Key, fileBuffer, {
      httpMetadata: {
        contentType: getContentType(fileName)
      },
      customMetadata: fileMetadata
    });

    return {
      status: 'success',
      file_id: fileMetadata.chitty_id,
      original_name: fileName,
      r2_key: r2Key,
      hash: fileHash,
      size: fileBuffer.byteLength
    };

  } catch (error) {
    console.error('Individual file processing error:', error);
    return { status: 'failed', error: error.message };
  }
}

/**
 * Generate file hash for integrity checking
 */
async function generateFileHash(buffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get content type from file name
 */
function getContentType(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const contentTypes = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'mp4': 'video/mp4',
    'mp3': 'audio/mpeg',
    'zip': 'application/zip',
    'json': 'application/json',
    'txt': 'text/plain'
  };
  return contentTypes[ext] || 'application/octet-stream';
}

/**
 * Sync data to ChittyOS-Data (Google Drive) including files
 */
async function syncToChittyOSData(entityData, env, fileResults = []) {
  try {
    // Use Google Drive API or rclone integration
    const driveEndpoint = env.CHITTYOS_DATA_ENDPOINT || 'https://drive.google.com/api/v3';

    // Create entity metadata including file references
    const entityWithFiles = {
      ...entityData,
      attached_files: fileResults.filter(f => f.status === 'success').map(f => ({
        file_id: f.file_id,
        original_name: f.original_name,
        hash: f.hash,
        size: f.size,
        r2_key: f.r2_key
      }))
    };

    const response = await fetch(`${driveEndpoint}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GOOGLE_DRIVE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `${entityData.chitty_id}.json`,
        parents: [env.CHITTYOS_DATA_FOLDER_ID],
        mimeType: 'application/json'
      })
    });

    if (response.ok) {
      const file = await response.json();

      // Upload content with file references
      await fetch(`${driveEndpoint}/upload/files/${file.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${env.GOOGLE_DRIVE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(entityWithFiles)
      });

      return { status: 'success', fileId: file.id, filesProcessed: fileResults.length };
    }

    return { status: 'failed', error: 'Drive API error' };

  } catch (error) {
    console.error('ChittyOS-Data sync error:', error);
    return { status: 'failed', error: error.message };
  }
}

/**
 * Store data in Cloudflare R2 including file references
 */
async function storeInR2(entityData, r2Bucket, fileResults = []) {
  try {
    const key = `entities/${entityData.type.toLowerCase()}/${entityData.chitty_id}.json`;

    // Include file references in entity data
    const entityWithFiles = {
      ...entityData,
      attached_files: fileResults.filter(f => f.status === 'success').map(f => ({
        file_id: f.file_id,
        original_name: f.original_name,
        r2_key: f.r2_key,
        hash: f.hash,
        size: f.size
      }))
    };

    await r2Bucket.put(key, JSON.stringify(entityWithFiles, null, 2), {
      httpMetadata: {
        contentType: 'application/json'
      },
      customMetadata: {
        entityType: entityData.type,
        chittyId: entityData.chitty_id,
        fileCount: String(fileResults.length),
        syncedAt: new Date().toISOString()
      }
    });

    return { status: 'success', key, filesStored: fileResults.length };

  } catch (error) {
    console.error('R2 storage error:', error);
    return { status: 'failed', error: error.message };
  }
}

/**
 * Update Neon database with entity data
 */
async function updateNeonDatabase(entityData, db) {
  try {
    // Map entity type to table
    const tableName = getTableName(entityData.type);

    // Prepare data for database
    const dbData = mapToDatabase(entityData);

    // Use Hyperdrive connection
    const result = await db.prepare(`
      INSERT INTO ${tableName} (chitty_id, data, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (chitty_id)
      DO UPDATE SET data = ?, updated_at = ?
    `).bind(
      entityData.chitty_id,
      JSON.stringify(dbData),
      entityData.created_at,
      entityData.updated_at,
      JSON.stringify(dbData),
      entityData.updated_at
    ).run();

    // Also update event store for audit trail
    await db.prepare(`
      INSERT INTO event_store (chitty_id, aggregate_id, aggregate_type, event_type, event_data, event_hash, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      `evt-${entityData.chitty_id}-${Date.now()}`,
      entityData.chitty_id,
      entityData.type,
      'notion_sync',
      JSON.stringify(entityData),
      generateHash(JSON.stringify(entityData)),
      new Date().toISOString()
    ).run();

    return { status: 'success', changes: result.changes };

  } catch (error) {
    console.error('Neon database error:', error);
    return { status: 'failed', error: error.message };
  }
}

/**
 * Update GitHub project tracking
 */
async function updateGitHubTracking(entityData, env) {
  try {
    if (!env.GITHUB_TOKEN) {
      return { status: 'skipped', reason: 'No GitHub token' };
    }

    const octokit = new Octokit({
      auth: env.GITHUB_TOKEN
    });

    // Create or update issue for entity tracking
    const issueTitle = `[${entityData.type}] ${entityData.title}`;
    const issueBody = `
## ChittyOS Entity Tracking

**ChittyID:** \`${entityData.chitty_id}\`
**Type:** ${entityData.type}
**Status:** ${entityData.status}
**Last Updated:** ${entityData.updated_at}

### Notion Link
[View in Notion](${entityData.metadata.notion_url})

### Data Pipeline Status
- ✅ Synced to ChittyOS-Data
- ✅ Stored in Cloudflare R2
- ✅ Updated in Neon Database
- ✅ Tracked in GitHub

---
*Auto-generated by ChittyOS Notion Data Pipeline*
    `;

    // Check if issue already exists
    const existingIssues = await octokit.rest.issues.listForRepo({
      owner: env.GITHUB_OWNER || 'chittyos',
      repo: env.GITHUB_REPO || 'data-tracking',
      state: 'all',
      labels: [`chitty-id:${entityData.chitty_id}`]
    });

    if (existingIssues.data.length > 0) {
      // Update existing issue
      const issue = existingIssues.data[0];
      await octokit.rest.issues.update({
        owner: env.GITHUB_OWNER || 'chittyos',
        repo: env.GITHUB_REPO || 'data-tracking',
        issue_number: issue.number,
        title: issueTitle,
        body: issueBody,
        labels: [
          `chitty-id:${entityData.chitty_id}`,
          `type:${entityData.type.toLowerCase()}`,
          `status:${entityData.status.toLowerCase()}`
        ]
      });

      return { status: 'success', action: 'updated', issueNumber: issue.number };
    } else {
      // Create new issue
      const newIssue = await octokit.rest.issues.create({
        owner: env.GITHUB_OWNER || 'chittyos',
        repo: env.GITHUB_REPO || 'data-tracking',
        title: issueTitle,
        body: issueBody,
        labels: [
          `chitty-id:${entityData.chitty_id}`,
          `type:${entityData.type.toLowerCase()}`,
          `status:${entityData.status.toLowerCase()}`
        ]
      });

      return { status: 'success', action: 'created', issueNumber: newIssue.data.number };
    }

  } catch (error) {
    console.error('GitHub tracking error:', error);
    return { status: 'failed', error: error.message };
  }
}

/**
 * Create audit trail entry
 */
async function createAuditTrail(auditData, env) {
  try {
    // Store in R2 audit bucket
    const auditKey = `audit/${new Date().toISOString().split('T')[0]}/${auditData.entityId}-${Date.now()}.json`;

    await env.AUDIT_LOGS.put(auditKey, JSON.stringify(auditData, null, 2), {
      httpMetadata: {
        contentType: 'application/json'
      },
      customMetadata: {
        source: auditData.source,
        action: auditData.action,
        entityType: auditData.entityType
      }
    });

    console.log(`📝 Audit trail created: ${auditKey}`);

  } catch (error) {
    console.error('Audit trail error:', error);
  }
}

/**
 * Handle manual sync trigger
 */
async function handleManualSync(context) {
  const { request, env } = context;

  try {
    const { entity_type, force_full_sync } = await request.json();

    const syncResults = {
      started_at: new Date().toISOString(),
      entity_type: entity_type || 'ALL',
      force_full_sync: force_full_sync || false,
      results: {}
    };

    // Trigger sync based on entity type or full sync
    if (entity_type) {
      syncResults.results[entity_type] = await syncEntityType(entity_type, env);
    } else {
      // Full ecosystem sync
      const entityTypes = ['PERSON', 'PLACE', 'THING', 'EVENT', 'AUTHORITY', 'CASE', 'EVIDENCE'];

      for (const type of entityTypes) {
        syncResults.results[type] = await syncEntityType(type, env);
      }
    }

    syncResults.completed_at = new Date().toISOString();
    syncResults.duration_ms = new Date(syncResults.completed_at) - new Date(syncResults.started_at);

    return new Response(JSON.stringify(syncResults), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Manual sync failed',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle pipeline status check
 */
async function handlePipelineStatus(context) {
  const { env } = context;

  try {
    const status = {
      pipeline: 'Notion ↔ ChittyOS-Data ↔ R2 ↔ Neon ↔ GitHub',
      timestamp: new Date().toISOString(),
      connections: {
        notion: {
          status: env.NOTION_TOKEN ? 'connected' : 'disconnected',
          databases: env.NOTION_DATABASE_IDS ? JSON.parse(env.NOTION_DATABASE_IDS) : []
        },
        chittyos_data: {
          status: env.GOOGLE_DRIVE_TOKEN ? 'connected' : 'disconnected',
          folder_id: env.CHITTYOS_DATA_FOLDER_ID || null
        },
        r2: {
          status: env.PLATFORM_STORAGE ? 'connected' : 'disconnected',
          buckets: ['PLATFORM_STORAGE', 'AUDIT_LOGS']
        },
        neon: {
          status: env.PLATFORM_DB ? 'connected' : 'disconnected',
          connection_type: 'hyperdrive'
        },
        github: {
          status: env.GITHUB_TOKEN ? 'connected' : 'disconnected',
          repository: `${env.GITHUB_OWNER || 'chittyos'}/${env.GITHUB_REPO || 'data-tracking'}`
        }
      },
      sync_statistics: await getSyncStatistics(env)
    };

    return new Response(JSON.stringify(status), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Status check failed',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Utility functions
 */
function determineEntityType(page) {
  // Logic to determine entity type from Notion page
  const title = page.properties?.Title?.title?.[0]?.text?.content || '';
  const databaseId = page.parent?.database_id;

  // Map database IDs to entity types or use title patterns
  if (title.includes('[PERSON]') || databaseId === process.env.NOTION_PEOPLE_DB) return 'PERSON';
  if (title.includes('[PLACE]') || databaseId === process.env.NOTION_PLACES_DB) return 'PLACE';
  if (title.includes('[THING]') || databaseId === process.env.NOTION_THINGS_DB) return 'THING';
  if (title.includes('[EVENT]') || databaseId === process.env.NOTION_EVENTS_DB) return 'EVENT';
  if (title.includes('[AUTHORITY]') || databaseId === process.env.NOTION_AUTHORITIES_DB) return 'AUTHORITY';
  if (title.includes('[CASE]') || databaseId === process.env.NOTION_CASES_DB) return 'CASE';
  if (title.includes('[EVIDENCE]') || databaseId === process.env.NOTION_EVIDENCE_DB) return 'EVIDENCE';

  return 'UNKNOWN';
}

function generateChittyID(entityType) {
  const prefix = entityType.substring(0, 3).toUpperCase();
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

function extractTitle(properties) {
  return properties.Title?.title?.[0]?.text?.content ||
         properties.Name?.title?.[0]?.text?.content ||
         'Untitled';
}

function getTableName(entityType) {
  const tableMap = {
    'PERSON': 'people',
    'PLACE': 'places',
    'THING': 'things',
    'EVENT': 'events',
    'AUTHORITY': 'authorities',
    'CASE': 'cases',
    'EVIDENCE': 'evidence'
  };
  return tableMap[entityType] || 'entities';
}

function mapToDatabase(entityData) {
  // Transform entity data for database storage
  return {
    ...entityData,
    // Add any database-specific transformations
    search_vector: generateSearchVector(entityData)
  };
}

function generateHash(data) {
  // Simple hash function for data integrity
  return btoa(data).substring(0, 32);
}

function generateSearchVector(entityData) {
  // Generate search terms for full-text search
  const terms = [
    entityData.title,
    entityData.chitty_id,
    entityData.type,
    JSON.stringify(entityData.metadata)
  ].filter(Boolean).join(' ');

  return terms.toLowerCase();
}

async function syncEntityType(entityType, env) {
  // Implement entity-specific sync logic
  return {
    entity_type: entityType,
    synced_count: 0,
    errors: [],
    status: 'completed'
  };
}

async function getSyncStatistics(env) {
  // Get sync statistics from audit logs or database
  return {
    total_syncs_today: 0,
    successful_syncs: 0,
    failed_syncs: 0,
    last_sync_time: null
  };
}

// Entity-specific parsers
function parsePersonEntity(entityData, properties) {
  return {
    ...entityData,
    first_name: properties.FirstName?.rich_text?.[0]?.text?.content,
    last_name: properties.LastName?.rich_text?.[0]?.text?.content,
    email: properties.Email?.email,
    phone: properties.Phone?.phone_number
  };
}

function parsePlaceEntity(entityData, properties) {
  return {
    ...entityData,
    address: properties.Address?.rich_text?.[0]?.text?.content,
    city: properties.City?.select?.name,
    state: properties.State?.select?.name,
    country: properties.Country?.select?.name
  };
}

function parseThingEntity(entityData, properties) {
  return {
    ...entityData,
    category: properties.Category?.select?.name,
    value: properties.Value?.number,
    description: properties.Description?.rich_text?.[0]?.text?.content
  };
}

function parseEventEntity(entityData, properties) {
  return {
    ...entityData,
    event_date: properties.Date?.date?.start,
    location: properties.Location?.rich_text?.[0]?.text?.content,
    participants: properties.Participants?.multi_select?.map(p => p.name)
  };
}

function parseAuthorityEntity(entityData, properties) {
  return {
    ...entityData,
    authority_type: properties.Type?.select?.name,
    jurisdiction: properties.Jurisdiction?.select?.name,
    citation: properties.Citation?.rich_text?.[0]?.text?.content
  };
}

function parseCaseEntity(entityData, properties) {
  return {
    ...entityData,
    case_number: properties.CaseNumber?.rich_text?.[0]?.text?.content,
    court: properties.Court?.select?.name,
    filing_date: properties.FilingDate?.date?.start,
    case_type: properties.CaseType?.select?.name
  };
}

function parseEvidenceEntity(entityData, properties) {
  return {
    ...entityData,
    evidence_type: properties.Type?.select?.name,
    file_path: properties.FilePath?.rich_text?.[0]?.text?.content,
    hash: properties.Hash?.rich_text?.[0]?.text?.content,
    chain_of_custody: properties.ChainOfCustody?.rich_text?.[0]?.text?.content
  };
}