// Simplified Email Worker for ChittyChat
// Handles email routing, tracking, and lead nurturing

export default {
  async email(message, env, ctx) {
    try {
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

      // Determine email category
      const recipient = message.to.toLowerCase();
      let category = 'general';
      let propertyType = null;
      let isTracking = false;

      // Check if this is a BCC tracking email
      if (recipient.includes('bcc@')) {
        category = 'tracking';
        isTracking = true;
      } else if (recipient.includes('city@') || recipient.includes('loft@') ||
                 recipient.includes('cozy@') || recipient.includes('villa@')) {
        category = 'property';
        propertyType = recipient.split('@')[0];
      } else if (recipient.includes('chico@')) {
        category = 'concierge';
        propertyType = 'chico-ai';
      } else if (recipient.includes('receipts@') || recipient.includes('bills@') ||
                 recipient.includes('finance@')) {
        category = 'financial';
      } else if (recipient.includes('support@')) {
        category = 'support';
      }

      // Get email body
      const bodyText = await message.text();

      // Generate unique ID for this email
      const chittyId = await generateEmailId(emailData);

      // Store email in R2
      const emailKey = isTracking
        ? `tracking/outbound/${chittyId}.json`
        : `emails/${category}/${propertyType || 'general'}/${chittyId}.json`;

      await env.EMAIL_INTAKE.put(emailKey, JSON.stringify({
        ...emailData,
        chittyId,
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

      // Process based on category
      if (category === 'property' || category === 'concierge') {
        // Extract lead data
        const leadData = extractLeadData(bodyText, emailData);

        // Store lead
        await env.EMAIL_INTAKE.put(
          `leads/${category}/${chittyId}.json`,
          JSON.stringify({
            ...emailData,
            chittyId,
            category,
            propertyType,
            lead: leadData,
            score: calculateLeadScore(leadData, bodyText),
            created_at: Date.now()
          })
        );

        // Send auto-reply
        if (category === 'property') {
          await message.reply({
            from: `${propertyType}@chitty.cc`,
            subject: `Re: ${emailData.subject}`,
            text: `Thank you for your interest in our ${propertyType} property.

Your inquiry has been received (ID: ${chittyId}).

A specialist will respond within 24 hours.

Best regards,
ChittyChat Property Management`
          });
        } else if (category === 'concierge') {
          await message.reply({
            from: 'chico@chitty.cc',
            subject: `Re: ${emailData.subject}`,
            text: `Hello! I'm Chico, your AI concierge.

I've received your request (ID: ${chittyId}).

I'll respond with personalized suggestions shortly.

At your service,
Chico AI 🤖`
          });
        }
      }

      // Log tracking info
      if (isTracking) {
        await env.EMAIL_INTAKE.put(
          `tracking/log/${chittyId}.json`,
          JSON.stringify({
            chittyId,
            messageId: emailData.messageId,
            subject: emailData.subject,
            recipients: emailData.actualRecipients,
            sentAt: emailData.timestamp,
            status: 'sent'
          })
        );
      }

      console.log(`Email processed: ${chittyId} - ${category}`);

    } catch (error) {
      console.error('Email processing error:', error);

      // Store error for debugging
      await env.EMAIL_INTAKE.put(
        `errors/${Date.now()}.json`,
        JSON.stringify({
          error: error.message,
          stack: error.stack,
          headers: Object.fromEntries(message.headers),
          timestamp: Date.now()
        })
      );
    }
  }
};

async function generateEmailId(emailData) {
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

function extractLeadData(body, emailData) {
  const patterns = {
    phone: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
    budget: /budget.*?\$?([\d,]+)/i,
    timeline: /(immediate|urgent|asap|this week|next week|this month)/i
  };

  const leadInfo = {
    email: emailData.from,
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

function calculateLeadScore(leadData, body) {
  let score = 0;

  if (leadData.phone) score += 20;
  if (leadData.budget) score += 30;
  if (leadData.timeline) score += 25;

  // Check for urgency
  const urgencyKeywords = ['urgent', 'immediate', 'asap', 'today'];
  urgencyKeywords.forEach(keyword => {
    if (body.toLowerCase().includes(keyword)) score += 10;
  });

  return Math.min(score, 100);
}