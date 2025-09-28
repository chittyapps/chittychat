// Durable Object for maintaining sync state
export class SyncState {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/schedule' && request.method === 'POST') {
      const data = await request.json();
      // Store nurture workflow schedule
      await this.state.storage.put('workflow', data);
      return new Response('Scheduled');
    }

    return new Response('SyncState OK');
  }
}

// Import AI Gateway library (conditionally)
async function createAIGateway(env) {
  // Inline AI Gateway functionality for now
  return {
    async enrichLead(leadData, body) {
      // Simplified lead enrichment
      return { ...leadData, enriched: true, lead_score: 75 };
    },
    async summarizeEmail(body, env) {
      // Use Workers AI if available
      if (env.AI) {
        try {
          const result = await env.AI.run('@cf/facebook/bart-large-cnn', {
            input_text: body.substring(0, 1000),
            max_length: 150
          });
          return result.summary || body.substring(0, 200);
        } catch (e) {
          return body.substring(0, 200);
        }
      }
      return body.substring(0, 200);
    },
    async generateEmbeddingsWorkersAI(text, env) {
      if (env.AI) {
        try {
          const result = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
            text: [text.substring(0, 512)]
          });
          return result.data[0];
        } catch (e) {
          // Return mock embedding
          return new Array(384).fill(0).map(() => Math.random());
        }
      }
      return new Array(384).fill(0).map(() => Math.random());
    }
  };
}

export default {
  async email(message, env, ctx) {
    try {
      // Initialize AI Gateway
      const ai = await createAIGateway(env);
      // Extract email details
      const emailData = {
        from: message.from,
        to: message.to,
        subject: message.headers.get('subject'),
        date: message.headers.get('date'),
        messageId: message.headers.get('message-id'),
        headers: Object.fromEntries(message.headers),
        rawSize: message.rawSize,
        timestamp: Date.now()
      };

      // Determine email category based on recipient
      const recipient = message.to.toLowerCase();
      let category = 'general';
      let propertyType = null;
      let isTracking = false;

      // Check if this is a BCC tracking email
      if (recipient.includes('bcc@')) {
        category = 'tracking';
        isTracking = true;

        // Extract actual recipients from headers
        const actualTo = message.headers.get('to') || '';
        const actualCc = message.headers.get('cc') || '';

        // Categorize based on actual recipient
        if (actualTo.includes('@chitty.cc')) {
          const actualRecipient = actualTo.toLowerCase();
          if (actualRecipient.includes('city@') || actualRecipient.includes('loft@') ||
              actualRecipient.includes('cozy@') || actualRecipient.includes('villa@')) {
            propertyType = 'property-outbound';
          } else if (actualRecipient.includes('chico@')) {
            propertyType = 'concierge-outbound';
          }
        }
      } else if (recipient.includes('city@')) {
        category = 'property';
        propertyType = 'city';
      } else if (recipient.includes('loft@')) {
        category = 'property';
        propertyType = 'loft';
      } else if (recipient.includes('cozy@')) {
        category = 'property';
        propertyType = 'cozy';
      } else if (recipient.includes('villa@')) {
        category = 'property';
        propertyType = 'villa';
      } else if (recipient.includes('chico@')) {
        category = 'concierge';
        propertyType = 'chico-ai';
      } else if (recipient.includes('receipts@') || recipient.includes('bills@') || recipient.includes('finance@')) {
        category = 'financial';
      } else if (recipient.includes('support@')) {
        category = 'support';
      } else if (recipient.includes('nick@')) {
        category = 'personal';
      }

      // Get email body
      const bodyText = await message.text();

      // Store raw email in R2
      const emailKey = isTracking
        ? `tracking/outbound/${new Date().toISOString()}-${emailData.messageId}.json`
        : propertyType
        ? `emails/${category}/${propertyType}/${new Date().toISOString()}-${emailData.messageId}.json`
        : `emails/${category}/${new Date().toISOString()}-${emailData.messageId}.json`;

      await env.EMAIL_INTAKE.put(emailKey, JSON.stringify({
        ...emailData,
        category,
        propertyType,
        body: bodyText,
        processed: false,
        isTracking,
        actualRecipients: isTracking ? {
          to: message.headers.get('to'),
          cc: message.headers.get('cc'),
          from: message.headers.get('from')
        } : null
      }));

      // Store attachments if present
      if (message.attachments && message.attachments.length > 0) {
        for (const attachment of message.attachments) {
          const attachmentKey = `attachments/${emailData.messageId}/${attachment.filename}`;
          const content = await attachment.arrayBuffer();
          await env.EMAIL_INTAKE.put(attachmentKey, content, {
            metadata: {
              contentType: attachment.contentType,
              emailId: emailData.messageId,
              filename: attachment.filename
            }
          });
        }
      }

      // Forward to processing pipeline
      await processEmail(emailData, bodyText, category, propertyType, isTracking, env);

      // Auto-reply for property inquiries
      if (category === 'property') {
        const propertyNames = {
          city: 'City Apartment',
          loft: 'Loft Space',
          cozy: 'Cozy Cottage',
          villa: 'Luxury Villa'
        };

        await message.reply({
          from: `${propertyType}@chitty.cc`,
          subject: `Re: ${emailData.subject} - ${propertyNames[propertyType]} Inquiry`,
          text: `Thank you for your interest in our ${propertyNames[propertyType]} property.

Your inquiry has been received and assigned tracking ID: ${emailData.messageId}

A property specialist will respond within 24 hours with:
- Availability details
- Pricing information
- Virtual tour scheduling options

Best regards,
ChittyChat Property Management`
        });
      }

      // Auto-reply for Chico AI Concierge
      if (category === 'concierge') {
        // Forward to Chico AI service for processing
        if (env.CHICO_WEBHOOK_URL) {
          await fetch(env.CHICO_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: emailData.from,
              subject: emailData.subject,
              body: bodyText,
              messageId: emailData.messageId,
              timestamp: emailData.timestamp
            })
          }).catch(err => console.error('Chico webhook error:', err));
        }

        await message.reply({
          from: 'chico@chitty.cc',
          subject: `Re: ${emailData.subject} - Chico AI Concierge`,
          text: `Hello! I'm Chico, your AI-powered concierge.

I've received your request and I'm already working on it!

Request ID: ${emailData.messageId}

I can help with:
- Restaurant reservations
- Travel planning
- Event tickets
- Local recommendations
- Service bookings
- And much more!

I'll respond with personalized suggestions shortly.

At your service,
Chico AI Concierge 🤖`
        });
      }

      // Auto-reply for support emails
      if (category === 'support') {
        await message.reply({
          from: 'support@chitty.cc',
          subject: `Re: ${emailData.subject}`,
          text: `Thank you for contacting ChittyChat Support.

Your request has been received and assigned ID: ${emailData.messageId}

We'll respond within 24 hours.

Best regards,
ChittyChat Support Team`
        });
      }

      console.log(`Email processed: ${recipient} - ${emailData.subject}`);
    } catch (error) {
      console.error('Email processing error:', error);
      // Store failed email for manual review
      const errorKey = `errors/${new Date().toISOString()}-${message.headers.get('message-id')}.json`;
      await env.EMAIL_INTAKE.put(errorKey, JSON.stringify({
        error: error.message,
        stack: error.stack,
        rawHeaders: Object.fromEntries(message.headers),
        timestamp: Date.now()
      }));
    }
  }
};

async function processEmail(emailData, body, category, propertyType, isTracking, env) {
  // Generate ChittyID for email/lead
  const chittyId = await generateEmailChittyId(emailData);

  // Handle email tracking and conversation threading
  if (isTracking || category === 'tracking') {
    await handleEmailTracking(emailData, body, chittyId, env);
  }

  // Thread conversation tracking for replies
  const threadId = await findEmailThread(emailData, env);
  if (threadId) {
    await updateEmailThread(threadId, emailData, body, chittyId, env);
  }

  // Lead nurturing for property and concierge categories
  if (category === 'property' || category === 'concierge') {
    const leadData = await extractLeadData(body, emailData);

    // Use AI to enrich lead data
    const ai = createAIGateway(env);
    const enrichedLead = await ai.enrichLead(leadData, body).catch(err => {
      console.error('AI enrichment failed:', err);
      return leadData; // Fallback to basic data
    });

    // Generate AI summary of the inquiry
    const summary = await ai.summarizeEmail(body, env).catch(err => {
      console.error('AI summary failed:', err);
      return body.substring(0, 200); // Fallback to truncated text
    });

    // Store enriched lead in database
    await env.EMAIL_INTAKE.put(
      `leads/${category}/${chittyId}.json`,
      JSON.stringify({
        ...emailData,
        chittyId,
        category,
        propertyType,
        lead: enrichedLead,
        summary,
        nurture_stage: 'new',
        score: enrichedLead.lead_score || calculateLeadScore(leadData, body),
        created_at: Date.now()
      })
    );

    // Store embedding metadata in R2 for now (Vectorize can be added later)
    const embedding = await ai.generateEmbeddingsWorkersAI(body, env);
    await env.EMAIL_INTAKE.put(
      `embeddings/${chittyId}.json`,
      JSON.stringify({
        id: chittyId,
        embedding,
        metadata: {
          category,
          propertyType,
          from: emailData.from,
          subject: emailData.subject,
          score: enrichedLead.lead_score
        }
      })
    );

    // Trigger lead nurturing workflow
    await triggerNurtureWorkflow(chittyId, category, propertyType, enrichedLead, env);
  }

  // Extract financial data if applicable
  if (category === 'financial') {
    const financialData = await extractFinancialData(body);
    if (financialData) {
      await env.EMAIL_INTAKE.put(
        `financial/${chittyId}.json`,
        JSON.stringify({
          ...emailData,
          chittyId,
          financial: financialData,
          processed_at: Date.now()
        })
      );
    }
  }

  // Send to Universal Intake for processing
  const intakePayload = {
    type: 'email',
    chittyId,
    source: emailData.to,
    content: body,
    metadata: emailData,
    timestamp: Date.now()
  };

  await fetch('http://localhost:3003/intake', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(intakePayload)
  }).catch(err => console.error('Universal Intake error:', err));

  // Trigger AutoRAG indexing
  if (env.AUTORAG) {
    await env.AUTORAG.index({
      document_id: chittyId,
      content: body,
      metadata: {
        type: 'email',
        category: emailData.category,
        from: emailData.from,
        subject: emailData.subject,
        date: emailData.date
      }
    });
  }
}

async function generateEmailChittyId(emailData) {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${emailData.messageId}-${emailData.timestamp}`)
  );
  return `EMAIL-${Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 16)
    .toUpperCase()}`;
}

async function extractFinancialData(body) {
  // Pattern matching for receipts and bills
  const patterns = {
    amount: /\$[\d,]+\.?\d*/g,
    invoice: /invoice\s*#?\s*(\w+)/i,
    orderNumber: /order\s*#?\s*(\w+)/i,
    date: /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g,
    vendor: /from:\s*(.+?)[\n\r]/i
  };

  const extracted = {};

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = body.match(pattern);
    if (match) {
      extracted[key] = match[0];
    }
  }

  return Object.keys(extracted).length > 0 ? extracted : null;
}

async function extractLeadData(body, emailData) {
  // Extract lead information from email
  const patterns = {
    phone: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
    budget: /budget.*?\$?([\d,]+)/i,
    timeline: /(immediate|urgent|asap|this week|next week|this month|next month)/i,
    location: /(downtown|suburbs|city center|near|location|area)/i
  };

  const leadInfo = {
    email: emailData.from,
    name: extractName(emailData.from),
    source: 'email',
    initial_contact: emailData.subject
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = body.match(pattern);
    if (match) {
      leadInfo[key] = match[1] || match[0];
    }
  }

  return leadInfo;
}

function extractName(email) {
  // Extract name from email address or return empty
  const nameMatch = email.match(/^([^@<]+)/);
  if (nameMatch) {
    return nameMatch[1].replace(/[._-]/g, ' ').trim();
  }
  return '';
}

function calculateLeadScore(leadData, body) {
  let score = 0;

  // Score based on completeness
  if (leadData.phone) score += 20;
  if (leadData.budget) score += 30;
  if (leadData.timeline) score += 25;
  if (leadData.location) score += 15;

  // Score based on urgency keywords
  const urgencyKeywords = ['urgent', 'immediate', 'asap', 'today', 'now'];
  urgencyKeywords.forEach(keyword => {
    if (body.toLowerCase().includes(keyword)) score += 10;
  });

  // Score based on engagement indicators
  if (body.length > 500) score += 10; // Detailed inquiry

  return Math.min(score, 100); // Cap at 100
}

async function triggerNurtureWorkflow(chittyId, category, propertyType, leadData, env) {
  // Create nurture workflow based on lead score and category
  const nurtureConfig = {
    high_priority: leadData.score >= 70,
    category,
    propertyType,
    follow_up_schedule: [
      { days: 1, type: 'welcome' },
      { days: 3, type: 'information' },
      { days: 7, type: 'check_in' },
      { days: 14, type: 'offer' },
      { days: 30, type: 're_engage' }
    ]
  };

  // Store nurture workflow
  await env.EMAIL_INTAKE.put(
    `nurture/${chittyId}.json`,
    JSON.stringify({
      chittyId,
      leadData,
      config: nurtureConfig,
      status: 'active',
      created_at: Date.now()
    })
  );

  // Schedule first follow-up using Durable Object
  if (env.SYNC_STATE) {
    const followUpId = env.SYNC_STATE.idFromName(chittyId);
    const followUp = env.SYNC_STATE.get(followUpId);
    await followUp.fetch('https://worker/schedule', {
      method: 'POST',
      body: JSON.stringify(nurtureConfig)
    });
  }
}

async function handleEmailTracking(emailData, body, chittyId, env) {
  // Track outbound email
  const trackingData = {
    chittyId,
    messageId: emailData.messageId,
    subject: emailData.subject,
    recipients: emailData.actualRecipients || {
      to: emailData.to,
      from: emailData.from
    },
    sentAt: emailData.timestamp,
    opens: [],
    clicks: [],
    replies: []
  };

  // Store tracking data
  await env.EMAIL_INTAKE.put(
    `tracking/${chittyId}.json`,
    JSON.stringify(trackingData)
  );

  // Create tracking pixel (if HTML email)
  if (body.includes('<html') || body.includes('<body')) {
    const pixelUrl = `https://track.chitty.cc/pixel/${chittyId}.gif`;
    // Pixel would be embedded in outbound emails
  }
}

async function findEmailThread(emailData, env) {
  // Look for thread by references header or in-reply-to
  const references = emailData.headers['references'];
  const inReplyTo = emailData.headers['in-reply-to'];
  const subject = emailData.subject.replace(/^(re:|fwd:)\s*/i, '').trim();

  // Search for existing thread
  if (inReplyTo) {
    const threadKey = `threads/by-message/${inReplyTo}.json`;
    const thread = await env.EMAIL_INTAKE.get(threadKey);
    if (thread) return JSON.parse(thread).threadId;
  }

  // Search by subject and participants
  const threadSearchKey = `threads/by-subject/${encodeURIComponent(subject)}.json`;
  const existingThread = await env.EMAIL_INTAKE.get(threadSearchKey);
  if (existingThread) {
    const thread = JSON.parse(existingThread);
    // Check if participants match
    if (thread.participants.includes(emailData.from)) {
      return thread.threadId;
    }
  }

  // Create new thread if none found
  const newThreadId = `THREAD-${Date.now()}`;
  await env.EMAIL_INTAKE.put(
    `threads/${newThreadId}.json`,
    JSON.stringify({
      threadId: newThreadId,
      subject,
      participants: [emailData.from, emailData.to],
      messages: [chittyId],
      created: Date.now(),
      lastActivity: Date.now()
    })
  );

  return newThreadId;
}

async function updateEmailThread(threadId, emailData, body, chittyId, env) {
  const threadKey = `threads/${threadId}.json`;
  const threadData = await env.EMAIL_INTAKE.get(threadKey);

  if (threadData) {
    const thread = JSON.parse(threadData);
    thread.messages.push(chittyId);
    thread.lastActivity = Date.now();

    // Track reply in original tracking record
    const originalTracking = await findOriginalTracking(thread.messages[0], env);
    if (originalTracking) {
      const tracking = JSON.parse(originalTracking);
      tracking.replies.push({
        messageId: emailData.messageId,
        from: emailData.from,
        timestamp: emailData.timestamp,
        chittyId
      });

      await env.EMAIL_INTAKE.put(
        `tracking/${tracking.chittyId}.json`,
        JSON.stringify(tracking)
      );
    }

    // Update thread
    await env.EMAIL_INTAKE.put(threadKey, JSON.stringify(thread));

    // Update conversation metrics
    await updateConversationMetrics(threadId, env);
  }
}

async function findOriginalTracking(messageId, env) {
  // This would search for the original tracking record
  // In production, you'd use a proper index or database query
  const list = await env.EMAIL_INTAKE.list({ prefix: 'tracking/' });
  for (const item of list.objects) {
    const data = await env.EMAIL_INTAKE.get(item.key);
    const tracking = JSON.parse(data);
    if (tracking.messageId === messageId) {
      return data;
    }
  }
  return null;
}

async function updateConversationMetrics(threadId, env) {
  // Update metrics for conversation tracking
  const metricsKey = `metrics/threads/${threadId}.json`;
  const existing = await env.EMAIL_INTAKE.get(metricsKey);
  const metrics = existing ? JSON.parse(existing) : {
    threadId,
    messageCount: 0,
    responseTime: [],
    participants: []
  };

  metrics.messageCount++;
  metrics.lastUpdated = Date.now();

  await env.EMAIL_INTAKE.put(metricsKey, JSON.stringify(metrics));
}