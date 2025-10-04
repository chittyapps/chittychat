# ChittyRouter MCP Desktop Extension

A Desktop Extension that provides seamless access to ChittyRouter's comprehensive MCP tools directly within Claude Desktop.

## Features

- **28 Integrated Tools** across 6 categories:
  - File System operations (read, write, manage files)
  - Git version control (status, commit, push, branch management)
  - Web & Network utilities (scraping, API calls, downloads)
  - Database operations (SQL queries, data processing)
  - AI Services (analysis, summarization, translation)
  - Legal & Court tools (Cook County case search, property lookup)

- **Cloud-Connected**: Leverages ChittyRouter's production infrastructure at `mcp.chitty.cc`
- **Secure Authentication**: Uses ChittyID tokens for enterprise-grade security
- **Local Caching**: Improves performance for read-only operations
- **Configurable**: Customizable endpoints, timeouts, and cache settings

## Installation

1. Download `chittyrouter-desktop.mcpb`
2. Double-click to install in Claude Desktop
3. Configure your ChittyID token from [https://id.chitty.cc](https://id.chitty.cc)

## Configuration

The extension requires these settings:

- **ChittyID Token** (required): Your authentication token from ChittyID service
- **MCP Endpoint** (optional): Defaults to `https://mcp.chitty.cc`
- **Enable Local Cache** (optional): Improves performance, enabled by default
- **Timeout Seconds** (optional): Request timeout, defaults to 30 seconds

## Available Tools

### File Operations
- `read_file` - Read file contents
- `write_file` - Write content to files
- `list_directory` - List directory contents
- `create_directory` - Create new directories
- `delete_file` - Remove files safely
- `copy_file` - Copy files between locations
- `move_file` - Move/rename files

### Git Operations
- `git_status` - Check repository status
- `git_commit` - Commit changes
- `git_push` - Push to remote
- `git_pull` - Pull from remote
- `git_branch` - Branch management
- `git_log` - View commit history
- `git_diff` - Show differences

### Web & Network
- `fetch_url` - Retrieve web content
- `web_search` - Search the web
- `api_request` - Make HTTP API calls
- `download_file` - Download files from URLs

### Database Operations
- `sql_query` - Execute SQL queries
- `csv_analyze` - Analyze CSV data
- `json_process` - Process JSON data
- `data_transform` - Transform data formats

### AI Services
- `text_analyze` - Analyze text content
- `code_review` - Review code quality
- `document_summarize` - Summarize documents
- `translation` - Translate text

### Legal & Court Tools
- `verify_case_number` - Verify Cook County case numbers
- `search_cases` - Search cases by party or attorney
- `get_court_calendar` - Get court calendar events
- `lookup_property_pin` - Look up property by PIN
- `check_filing_compliance` - Check filing requirements

## Architecture

This extension acts as a bridge between Claude Desktop and ChittyRouter's cloud infrastructure:

```
Claude Desktop ↔ Desktop Extension ↔ ChittyMCP (mcp.chitty.cc) ↔ 28 Unified Tools
                                                                    ↓
                                                         ChittyCases (scraped data)
```

Benefits:
- **Unified endpoint** - All 28 tools through single MCP server
- **No local dependencies** - All processing happens in the cloud
- **Always up-to-date** - Tools automatically updated on the server
- **Enterprise security** - ChittyID authentication and audit trails
- **Performance optimized** - Local caching for frequent operations
- **Real scraped data** - ChittyCases provides actual Cook County data

## Support

- **Documentation**: [https://docs.chitty.cc](https://docs.chitty.cc)
- **ChittyID Service**: [https://id.chitty.cc](https://id.chitty.cc)
- **MCP Server Status**: [https://mcp.chitty.cc/health](https://mcp.chitty.cc/health)

## License

MIT License - ChittyCorp LLC