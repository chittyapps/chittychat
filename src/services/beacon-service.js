/**
 * Beacon Service Handler
 * Application monitoring and health checks
 */

export async function handleBeaconService(request, env, ctx) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Health check
  if (pathname === '/health') {
    return new Response(JSON.stringify({
      status: 'healthy',
      service: 'Beacon Service',
      uptime: Math.floor(Date.now() / 1000),
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Default response
  return new Response(JSON.stringify({
    service: 'ChittyOS Beacon Service',
    version: '1.0.0',
    endpoints: ['/health']
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}