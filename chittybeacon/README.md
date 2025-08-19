# @chittycorp/chittybeacon

Dead simple app tracking. Just require and forget.

## Installation

```bash
npm install @chittycorp/chittybeacon
```

## Usage

Add to your app's entry point:

```javascript
require('@chittycorp/chittybeacon');
```

That's it! Your app will now report:
- Startup/shutdown events
- Periodic heartbeats (every 5 minutes)
- Platform detection (Replit, GitHub, Vercel, etc.)
- Claude Code detection
- Git information

## Configuration

Optional environment variables:

- `BEACON_ENDPOINT` - Custom tracking endpoint (default: https://beacon.cloudeto.com)
- `BEACON_INTERVAL` - Heartbeat interval in ms (default: 300000)
- `BEACON_DISABLED` - Set to 'true' to disable
- `BEACON_VERBOSE` - Set to 'true' for debug output

## What Gets Tracked

```javascript
{
  id: "replit-abc123",
  name: "my-app",
  version: "1.0.0",
  platform: "replit",
  has_claude_code: true,
  has_git: true,
  // ... and more
}
```

## Platform Support

Automatically detects:
- Replit
- GitHub Actions
- Vercel
- Netlify
- Heroku
- AWS Lambda
- Google Cloud
- Azure
- And more...

## Privacy

Only tracks:
- App identity and version
- Platform information
- Basic system info (Node version, OS)
- No personal data
- No environment secrets

## License

MIT
