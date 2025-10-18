# GitHub Templates for ChittyOS Project Initiation

This directory contains GitHub issue and pull request templates used by the ChittyOS Project Initiation Service.

## Templates

### Issue Template: Project Task

**File**: `ISSUE_TEMPLATE/project_task.yml`

Automatically used when creating project tasks via the initiation service. Includes:
- ChittyID for unique identification
- Priority levels (Critical, High, Medium, Low)
- Milestone association
- Context ID for ChittyConnect tracking
- Acceptance criteria
- Technology tags

### Pull Request Template

**File**: `PULL_REQUEST_TEMPLATE.md`

Standard template for all pull requests in ChittyOS projects. Includes:
- Issue linking with ChittyID references
- Change summary and type classification
- Testing checklist
- ChittyOS integration details
- Deployment notes

## Installation

To use these templates in a repository:

### Option 1: Copy to Repository

```bash
# From the repository root
mkdir -p .github/ISSUE_TEMPLATE
cp github-templates/ISSUE_TEMPLATE/project_task.yml .github/ISSUE_TEMPLATE/
cp github-templates/PULL_REQUEST_TEMPLATE.md .github/
```

### Option 2: Automated via Project Initiation Service

The Project Initiation Service automatically creates these templates when initializing a new project.

## Usage

### Creating Project Tasks

1. Navigate to repository → Issues → New Issue
2. Select "Project Task" template
3. Fill in required fields:
   - **ChittyID**: Auto-populated by initiation service
   - **Priority**: Select from dropdown
   - **Milestone**: Select from repository milestones
   - **Context ID**: ChittyConnect context (if applicable)
   - **Description**: Detailed task description
   - **Acceptance Criteria**: Checklist of completion requirements
   - **Estimated Days**: 1-3 days
   - **Technology Tags**: Select relevant tags

### Creating Pull Requests

1. Create a branch and make changes
2. Push to GitHub and create PR
3. Template auto-populates in PR description
4. Fill in required sections:
   - Link to related issues with ChittyID
   - Summarize changes
   - Complete testing checklist
   - Add ChittyOS integration details
   - Document deployment notes

## Customization

### Adding Custom Fields to Issue Template

Edit `ISSUE_TEMPLATE/project_task.yml`:

```yaml
  - type: input
    id: custom_field
    attributes:
      label: Custom Field
      description: Description of custom field
    validations:
      required: false
```

### Adding Custom Sections to PR Template

Edit `PULL_REQUEST_TEMPLATE.md` and add sections as needed.

## Integration with ChittyOS

These templates integrate with:

- **ChittyID Service**: Unique identifiers for all tasks
- **ChittyConnect**: Context tracking across projects
- **ChittyLedger**: Audit trail for all changes
- **ChittySync**: Synchronization with Notion/To-Do Hub
- **Project Initiation Service**: Automated project setup

## Best Practices

1. **Always include ChittyID**: Essential for tracking and audit
2. **Link issues in PRs**: Use "Closes #123" syntax
3. **Complete all checklists**: Ensure quality and compliance
4. **Tag appropriately**: Makes filtering and search easier
5. **Document acceptance criteria**: Clear definition of done

## Support

For questions or issues with templates:
- GitHub Issues: https://github.com/chittyos/chittychat/issues
- Documentation: https://docs.chitty.cc
- Service Health: https://initiate.chitty.cc/health

---

**Part of ChittyOS Project Initiation Service v1.0.0**
