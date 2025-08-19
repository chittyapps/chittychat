# GitHub Self-Hosted Runner Setup for ChittyPM

## Why Self-Hosted Runners?

Self-hosted runners give you:
- **Full control** over the deployment environment
- **No usage limits** (GitHub Actions has monthly limits)
- **Cost savings** for high-volume CI/CD
- **Private network access** for internal deployments
- **Custom hardware/software** configurations

## Setup Instructions

### 1. Prepare Your Server

Requirements:
- Linux server (Ubuntu 20.04+ recommended)
- 2GB+ RAM
- 10GB+ storage
- Node.js 20+
- PostgreSQL 14+

### 2. Install GitHub Runner

```bash
# Create runner directory
mkdir actions-runner && cd actions-runner

# Download latest runner
curl -o actions-runner-linux-x64-2.311.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz

# Extract
tar xzf ./actions-runner-linux-x64-2.311.0.tar.gz

# Configure runner (get token from GitHub repo settings)
./config.sh --url https://github.com/YOUR_ORG/YOUR_REPO --token YOUR_TOKEN
```

### 3. Install Dependencies

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Create database
sudo -u postgres createdb chittypm
```

### 4. Configure Environment

Create `.env` file:
```bash
DATABASE_URL=postgresql://user:pass@localhost/chittypm
PORT=5000
CHITTYID_API_URL=https://api.chittyid.com
CHITTYID_API_KEY=your_key
REGISTRY_URL=https://registry.chitty.cc
REGISTRY_API_KEY=your_key
```

### 5. Start Runner Service

```bash
# Install as service
sudo ./svc.sh install

# Start service
sudo ./svc.sh start

# Check status
sudo ./svc.sh status
```

### 6. Configure GitHub Repository

1. Go to Settings → Actions → Runners
2. Add new self-hosted runner
3. Follow the configuration steps
4. Runner will appear as "self-hosted" in workflows

## Using the Runner in Workflows

The workflow files are already created:
- `.github/workflows/self-hosted-runner.yml` - Deploys on self-hosted runner
- `.github/workflows/deploy.yml` - Multi-platform deployment

To use, simply push to main branch or manually trigger the workflow.

## PM2 Process Management

The runner uses PM2 to manage the ChittyPM process:

```bash
# View logs
pm2 logs chittypm

# Restart application
pm2 restart chittypm

# Monitor resources
pm2 monit

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

## Security Considerations

1. **Use a dedicated user** for the runner (not root)
2. **Firewall rules** - Only allow necessary ports (5000 for app, 22 for SSH)
3. **Use secrets** in GitHub for sensitive data
4. **Regular updates** - Keep runner and dependencies updated
5. **Monitor logs** - Check runner and application logs regularly

## Troubleshooting

### Runner not starting
```bash
# Check runner status
sudo ./svc.sh status

# View runner logs
journalctl -u actions.runner.YOUR_REPO.YOUR_RUNNER -f
```

### Application not accessible
```bash
# Check if app is running
pm2 status

# Check port binding
netstat -tulpn | grep 5000

# Check firewall
sudo ufw status
```

### Database connection issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
psql -U postgres -d chittypm
```

## Cost Analysis

Self-hosted runner on various platforms:
- **Home server/Raspberry Pi**: $0/month (electricity only)
- **DigitalOcean Droplet**: $6/month (Basic)
- **AWS EC2 t3.micro**: ~$8/month
- **Hetzner Cloud**: €4.51/month
- **Oracle Cloud**: FREE (Always Free tier)

Compared to GitHub Actions:
- GitHub Free: 2,000 minutes/month
- GitHub Pro: 3,000 minutes/month ($4/month)
- Self-hosted: Unlimited minutes