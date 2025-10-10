/**
 * ChittyID Helper - Simplified ChittyID service integration
 * Compliant with §36 (ChittyID Authority)
 *
 * @see https://id.chitty.cc/docs
 */

export interface ChittyIDMintRequest {
  domain: string;
  subtype: string;
  metadata?: Record<string, any>;
}

export interface ChittyIDMintResponse {
  chitty_id: string;
  domain: string;
  subtype: string;
  created_at: string;
}

/**
 * Mint a new ChittyID from id.chitty.cc service
 *
 * @param request - ChittyID mint request
 * @param fallback - Optional fallback ID generator (for service outages)
 * @returns ChittyID string
 */
export async function mintChittyID(
  request: ChittyIDMintRequest,
  fallback?: () => string
): Promise<string> {
  try {
    const response = await fetch('https://id.chitty.cc/v1/mint', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CHITTY_ID_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`ChittyID service error: ${response.status}`);
    }

    const data: ChittyIDMintResponse = await response.json();
    return data.chitty_id;
  } catch (error) {
    console.error('ChittyID minting failed:', error);

    if (fallback) {
      const fallbackId = fallback();
      console.warn('Using fallback ID:', fallbackId);
      return fallbackId;
    }

    throw error;
  }
}

/**
 * Generate a timestamp-based fallback ID (for emergency use only)
 * NOT compliant with §36, only use when ChittyID service is unavailable
 */
export function generateFallbackID(prefix: string = 'temp'): string {
  return `${prefix}_${Date.now()}`;
}

