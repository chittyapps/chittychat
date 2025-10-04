# ChittyRouter Desktop Extension - Installation & Usage Guide

## 🚀 Quick Start

### Installation
1. **Download** the extension: `chittyrouter-desktop.mcpb`
2. **Install** in Claude Desktop by double-clicking the file
3. **Configure** your ChittyID token when prompted
4. **Start using** 23 powerful tools immediately!

### Get Your ChittyID Token
1. Visit [https://id.chitty.cc](https://id.chitty.cc)
2. Sign up or log in to your ChittyCorp account
3. Generate a new token for desktop usage
4. Copy the token (format: `CHITTY-TOKEN-...`)

## 🛠️ Available Tools Overview

### File System (7 tools)
Perfect for managing files and directories:
- **read_file** - View file contents instantly
- **write_file** - Create and edit files
- **list_directory** - Browse folder contents
- **create_directory** - Make new folders
- **delete_file** - Remove files safely
- **copy_file** - Duplicate files
- **move_file** - Reorganize files

### Git Operations (7 tools)
Complete version control workflow:
- **git_status** - Check what's changed
- **git_commit** - Save your progress
- **git_push** - Share with team
- **git_pull** - Get latest updates
- **git_branch** - Manage branches
- **git_log** - View history
- **git_diff** - See exact changes

### Web & Network (4 tools)
Internet and API integration:
- **fetch_url** - Get webpage content
- **web_search** - Search the internet
- **api_request** - Call REST APIs
- **download_file** - Save files from web

### Database Operations (4 tools)
Data analysis and management:
- **sql_query** - Run database queries
- **csv_analyze** - Process spreadsheets
- **json_process** - Handle JSON data
- **data_transform** - Convert between formats

### AI Services (4 tools)
Intelligent content processing:
- **text_analyze** - Extract insights from text
- **code_review** - Get coding feedback
- **document_summarize** - Create summaries
- **translation** - Translate languages

## 💡 Example Usage

### File Management
```
"Read the contents of my README.md file"
→ Uses: read_file tool with path parameter

"Create a new directory called 'project-docs'"
→ Uses: create_directory tool
```

### Git Workflow
```
"What's the status of my git repository?"
→ Uses: git_status tool

"Commit my changes with message 'Add new feature'"
→ Uses: git_commit tool
```

### Research & Analysis
```
"Search for recent news about AI developments"
→ Uses: web_search tool

"Analyze this CSV file for trends"
→ Uses: csv_analyze tool
```

## ⚙️ Configuration Options

### Basic Settings
- **ChittyID Token**: Your authentication (required)
- **MCP Endpoint**: Server URL (defaults to `https://mcp.chitty.cc`)

### Performance Settings
- **Enable Local Cache**: Speeds up repeated operations (recommended: ON)
- **Timeout Seconds**: How long to wait for responses (default: 30s)

### Advanced Settings
- **Custom Endpoint**: Use private ChittyRouter deployment
- **Debug Mode**: Enable detailed logging for troubleshooting

## 🔧 Troubleshooting

### Common Issues

**"Authentication failed"**
- Verify your ChittyID token is correct
- Check token hasn't expired at [https://id.chitty.cc](https://id.chitty.cc)
- Ensure no extra spaces when copying token

**"Connection timeout"**
- Check internet connection
- Increase timeout in settings if needed
- Verify ChittyRouter server status at [mcp.chitty.cc/health](https://mcp.chitty.cc/health)

**"Tool not found"**
- Extension may be using cached tool list
- Restart Claude Desktop to refresh
- Check if tool name is spelled correctly

**"Performance is slow"**
- Enable local caching in settings
- Check network connection
- Consider using a different endpoint if available

### Getting Help
- **Server Status**: [https://mcp.chitty.cc/health](https://mcp.chitty.cc/health)
- **Documentation**: [https://docs.chitty.cc](https://docs.chitty.cc)
- **Account Management**: [https://id.chitty.cc](https://id.chitty.cc)

## 🏗️ Architecture Details

### How It Works
```
Claude Desktop ←→ Desktop Extension ←→ ChittyRouter Cloud ←→ 23 Tools
```

1. **You ask** Claude to perform a task
2. **Extension** authenticates with your ChittyID token
3. **Request** is sent securely to ChittyRouter cloud infrastructure
4. **Tools execute** in optimized cloud environment
5. **Results** are returned to you in Claude Desktop

### Benefits of This Architecture
- **Zero Maintenance**: Tools update automatically in the cloud
- **Enterprise Security**: ChittyID authentication with audit trails
- **High Performance**: Cloud infrastructure optimized for speed
- **Always Available**: No local dependencies to manage
- **Cross-Platform**: Works on any system running Claude Desktop

### Privacy & Security
- Your ChittyID token is stored securely by Claude Desktop
- All communication uses HTTPS encryption
- No sensitive data is logged or stored
- Full audit trail available through ChittyID service

## 📊 Usage Analytics

Track your tool usage through the ChittyID dashboard:
- See which tools you use most
- Monitor performance and response times
- View authentication and access logs
- Set up usage alerts and limits

## 🎯 Power User Tips

### Combine Tools for Workflows
```
"Check git status, then if there are changes, commit them and push to origin"
→ Combines: git_status → git_commit → git_push
```

### Use with File Operations
```
"Read my config file, update the API endpoint, and save it back"
→ Combines: read_file → (Claude processes) → write_file
```

### Research and Documentation
```
"Search for information about this topic, then create a summary document"
→ Combines: web_search → (Claude analyzes) → write_file
```

## 🔄 Updates

The Desktop Extension automatically stays current with ChittyRouter's cloud infrastructure:
- **New tools** become available instantly
- **Bug fixes** are deployed without user action
- **Performance improvements** benefit all users immediately
- **Security updates** are applied transparently

Check for extension updates periodically through Claude Desktop's extension manager.

---

**Ready to get started?** Install `chittyrouter-desktop.mcpb` and unlock the full power of ChittyRouter's 23 tools in your Claude Desktop workflow! 🚀