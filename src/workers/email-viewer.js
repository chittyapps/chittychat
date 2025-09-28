// Email Viewer Worker - Access and search stored emails

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    try {
      // Route handling
      switch (path) {
        case '/':
          return new Response(getHomepage(), {
            headers: { 'Content-Type': 'text/html' }
          });

        case '/api/emails':
          return handleListEmails(url, env, headers);

        case '/api/email':
          return handleGetEmail(url, env, headers);

        case '/api/search':
          return handleSearchEmails(url, env, headers);

        case '/api/leads':
          return handleListLeads(url, env, headers);

        case '/api/tracking':
          return handleTracking(url, env, headers);

        case '/api/stats':
          return handleStats(env, headers);

        default:
          if (path.startsWith('/view/')) {
            return handleViewEmail(path.substring(6), env);
          }
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers
      });
    }
  }
};

async function handleListEmails(url, env, headers) {
  const category = url.searchParams.get('category') || 'all';
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const prefix = category === 'all' ? 'emails/' : `emails/${category}/`;

  const list = await env.EMAIL_INTAKE.list({
    prefix,
    limit
  });

  const emails = await Promise.all(
    list.objects.slice(0, limit).map(async (obj) => {
      const data = await env.EMAIL_INTAKE.get(obj.key);
      const email = JSON.parse(data);
      return {
        key: obj.key,
        chittyId: email.chittyId,
        from: email.from,
        to: email.to,
        subject: email.subject,
        category: email.category,
        timestamp: email.timestamp,
        propertyType: email.propertyType
      };
    })
  );

  return new Response(JSON.stringify({
    emails,
    count: emails.length,
    hasMore: list.truncated
  }), { headers });
}

async function handleGetEmail(url, env, headers) {
  const key = url.searchParams.get('key');
  const chittyId = url.searchParams.get('id');

  let emailKey = key;
  if (!emailKey && chittyId) {
    // Search for email by chittyId
    const list = await env.EMAIL_INTAKE.list({ prefix: 'emails/' });
    for (const obj of list.objects) {
      if (obj.key.includes(chittyId)) {
        emailKey = obj.key;
        break;
      }
    }
  }

  if (!emailKey) {
    return new Response(JSON.stringify({ error: 'Email not found' }), {
      status: 404,
      headers
    });
  }

  const data = await env.EMAIL_INTAKE.get(emailKey);
  const email = JSON.parse(data);

  return new Response(JSON.stringify(email), { headers });
}

async function handleSearchEmails(url, env, headers) {
  const query = url.searchParams.get('q') || '';
  const searchIn = url.searchParams.get('in') || 'all';

  const list = await env.EMAIL_INTAKE.list({ prefix: 'emails/' });
  const results = [];

  for (const obj of list.objects) {
    const data = await env.EMAIL_INTAKE.get(obj.key);
    const email = JSON.parse(data);

    // Search in specified fields
    let match = false;
    if (searchIn === 'all' || searchIn === 'subject') {
      match = match || email.subject?.toLowerCase().includes(query.toLowerCase());
    }
    if (searchIn === 'all' || searchIn === 'from') {
      match = match || email.from?.toLowerCase().includes(query.toLowerCase());
    }
    if (searchIn === 'all' || searchIn === 'body') {
      match = match || email.body?.toLowerCase().includes(query.toLowerCase());
    }

    if (match) {
      results.push({
        key: obj.key,
        chittyId: email.chittyId,
        from: email.from,
        to: email.to,
        subject: email.subject,
        category: email.category,
        timestamp: email.timestamp,
        snippet: email.body?.substring(0, 200)
      });
    }

    if (results.length >= 50) break;
  }

  return new Response(JSON.stringify({
    query,
    results,
    count: results.length
  }), { headers });
}

async function handleListLeads(url, env, headers) {
  const list = await env.EMAIL_INTAKE.list({ prefix: 'leads/' });
  const leads = [];

  for (const obj of list.objects) {
    const data = await env.EMAIL_INTAKE.get(obj.key);
    const lead = JSON.parse(data);
    leads.push({
      key: obj.key,
      chittyId: lead.chittyId,
      email: lead.lead?.email || lead.from,
      score: lead.score,
      category: lead.category,
      propertyType: lead.propertyType,
      created: lead.created_at
    });
  }

  // Sort by score
  leads.sort((a, b) => (b.score || 0) - (a.score || 0));

  return new Response(JSON.stringify({
    leads,
    count: leads.length
  }), { headers });
}

async function handleTracking(url, env, headers) {
  const list = await env.EMAIL_INTAKE.list({ prefix: 'tracking/' });
  const tracking = [];

  for (const obj of list.objects) {
    if (obj.key.includes('/log/')) {
      const data = await env.EMAIL_INTAKE.get(obj.key);
      tracking.push(JSON.parse(data));
    }
  }

  return new Response(JSON.stringify({
    tracking,
    count: tracking.length
  }), { headers });
}

async function handleStats(env, headers) {
  const stats = {
    categories: {},
    total: 0,
    leads: 0,
    tracking: 0
  };

  // Count emails by category
  const emailsList = await env.EMAIL_INTAKE.list({ prefix: 'emails/' });
  for (const obj of emailsList.objects) {
    stats.total++;
    const parts = obj.key.split('/');
    if (parts[1]) {
      stats.categories[parts[1]] = (stats.categories[parts[1]] || 0) + 1;
    }
  }

  // Count leads
  const leadsList = await env.EMAIL_INTAKE.list({ prefix: 'leads/' });
  stats.leads = leadsList.objects.length;

  // Count tracking
  const trackingList = await env.EMAIL_INTAKE.list({ prefix: 'tracking/' });
  stats.tracking = trackingList.objects.length;

  return new Response(JSON.stringify(stats), { headers });
}

async function handleViewEmail(chittyId, env) {
  // Find and display email in HTML format
  const list = await env.EMAIL_INTAKE.list({ prefix: 'emails/' });
  let email = null;

  for (const obj of list.objects) {
    if (obj.key.includes(chittyId)) {
      const data = await env.EMAIL_INTAKE.get(obj.key);
      email = JSON.parse(data);
      break;
    }
  }

  if (!email) {
    return new Response('Email not found', { status: 404 });
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Email: ${email.subject}</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 20px; }
    .header { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .field { margin: 10px 0; }
    .label { font-weight: bold; color: #666; }
    .body { background: white; border: 1px solid #ddd; padding: 20px; border-radius: 8px; white-space: pre-wrap; }
    .meta { background: #e8f4f8; padding: 15px; border-radius: 8px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h2>${email.subject}</h2>
    <div class="field"><span class="label">From:</span> ${email.from}</div>
    <div class="field"><span class="label">To:</span> ${email.to}</div>
    <div class="field"><span class="label">Date:</span> ${new Date(email.timestamp).toLocaleString()}</div>
    <div class="field"><span class="label">ID:</span> ${email.chittyId}</div>
  </div>

  <div class="body">${email.body}</div>

  <div class="meta">
    <div class="field"><span class="label">Category:</span> ${email.category}</div>
    ${email.propertyType ? `<div class="field"><span class="label">Property:</span> ${email.propertyType}</div>` : ''}
    ${email.score ? `<div class="field"><span class="label">Lead Score:</span> ${email.score}</div>` : ''}
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

function getHomepage() {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>ChittyChat Email Viewer</title>
  <style>
    body { font-family: system-ui; max-width: 1200px; margin: 40px auto; padding: 20px; }
    h1 { color: #333; }
    .section { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .endpoint { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 3px solid #0066cc; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
    .method { color: #0066cc; font-weight: bold; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>📧 ChittyChat Email Viewer</h1>

  <div class="section">
    <h2>Quick Links</h2>
    <p>
      <a href="/api/emails">📬 All Emails</a> |
      <a href="/api/emails?category=property">🏠 Property Inquiries</a> |
      <a href="/api/emails?category=financial">💰 Financial</a> |
      <a href="/api/leads">🎯 Leads</a> |
      <a href="/api/tracking">📊 Tracking</a> |
      <a href="/api/stats">📈 Stats</a>
    </p>
  </div>

  <div class="section">
    <h2>API Endpoints</h2>

    <div class="endpoint">
      <span class="method">GET</span> <code>/api/emails</code>
      <p>List all emails. Query params: <code>category</code>, <code>limit</code></p>
    </div>

    <div class="endpoint">
      <span class="method">GET</span> <code>/api/email</code>
      <p>Get specific email. Query params: <code>key</code> or <code>id</code></p>
    </div>

    <div class="endpoint">
      <span class="method">GET</span> <code>/api/search</code>
      <p>Search emails. Query params: <code>q</code> (query), <code>in</code> (subject/from/body/all)</p>
    </div>

    <div class="endpoint">
      <span class="method">GET</span> <code>/api/leads</code>
      <p>List all leads sorted by score</p>
    </div>

    <div class="endpoint">
      <span class="method">GET</span> <code>/api/tracking</code>
      <p>View email tracking data</p>
    </div>

    <div class="endpoint">
      <span class="method">GET</span> <code>/api/stats</code>
      <p>Email statistics and counts</p>
    </div>

    <div class="endpoint">
      <span class="method">GET</span> <code>/view/{chittyId}</code>
      <p>View email in HTML format</p>
    </div>
  </div>

  <div class="section">
    <h2>Categories</h2>
    <ul>
      <li><strong>property</strong> - Real estate inquiries (city, loft, cozy, villa)</li>
      <li><strong>concierge</strong> - Chico AI requests</li>
      <li><strong>financial</strong> - Receipts, bills, finance</li>
      <li><strong>support</strong> - Support tickets</li>
      <li><strong>tracking</strong> - BCC tracked outbound emails</li>
      <li><strong>general</strong> - Everything else</li>
    </ul>
  </div>
</body>
</html>`;
}