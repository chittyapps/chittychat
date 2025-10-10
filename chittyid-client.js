// ChittyID Service Client
const CHITTYID_SERVICE = process.env.CHITTYID_SERVICE_URL || 'https://id.chitty.cc';

class ChittyIDClient {
  constructor(token) {
    this.token = token || process.env.CHITTY_ID_TOKEN;
    if (!this.token) {
      throw new Error('CHITTY_ID_TOKEN required');
    }
  }

  async mint(domain, subtype, metadata = {}) {
    const response = await fetch(`${CHITTYID_SERVICE}/v1/mint`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${this.token}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ domain, subtype, metadata })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ChittyID mint failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.chitty_id;
  }

  async validate(chittyId) {
    const response = await fetch(`${CHITTYID_SERVICE}/v1/validate/${chittyId}`, {
      headers: { 'authorization': `Bearer ${this.token}` }
    });
    return response.ok;
  }

  async lookup(chittyId) {
    const response = await fetch(`${CHITTYID_SERVICE}/v1/lookup/${chittyId}`, {
      headers: { 'authorization': `Bearer ${this.token}` }
    });

    if (!response.ok) {
      throw new Error(`ChittyID lookup failed: ${response.status}`);
    }

    return response.json();
  }
}

module.exports = { ChittyIDClient };
// For ES6: export { ChittyIDClient };
