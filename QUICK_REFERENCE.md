# bc-fizzy-migrate CLI - Quick Reference

## Installation

```bash
cd /Users/mulder/Sites/opencode/basecamp_x_fizzy/cli
npm install
npm link
```

## Commands

### Authentication

```bash
# Authenticate with Basecamp (OAuth)
bf auth basecamp

# Authenticate with Fizzy (Personal Access Token)
bf auth fizzy

# Check authentication status
bf auth
bf auth status
```

### List Resources

```bash
# List Basecamp projects
bf list projects

# List card tables in a project
bf list cardtables --project=<project_id>

# List Fizzy boards
bf list boards
bf list boards --account=<account_slug>

# List columns in a board
bf list columns --account=<account_slug> --board=<board_id>
```

### Migration (Not Yet Implemented)

```bash
# Basic migration
bf migrate \
  --project=<project_id> \
  --cardtable=<cardtable_id> \
  --account=<account_slug> \
  --board=<board_id>

# Create new board and migrate
bf migrate \
  --project=<project_id> \
  --cardtable=<cardtable_id> \
  --account=<account_slug> \
  --create-board="My New Board"

# Full migration with all options
bf migrate \
  --project=<project_id> \
  --cardtable=<cardtable_id> \
  --account=<account_slug> \
  --board=<board_id> \
  --migrate-comments \
  --update-existing \
  --batch-size=20 \
  --verbose

# Dry run (preview without changes)
bf migrate \
  --project=<project_id> \
  --cardtable=<cardtable_id> \
  --account=<account_slug> \
  --board=<board_id> \
  --dry-run
```

### Configuration

```bash
# Show current config (tokens masked)
bf config show

# Reset configuration
bf config reset
```

### Other Commands (Not Yet Implemented)

```bash
# Map users interactively
bf map-users --project=<project_id> --account=<account_slug>

# Resume a migration
bf resume <migration_id>
```

## Options Reference

### Global Options
- `-V, --version` - Show version
- `-h, --help` - Show help

### Migrate Options
- `--project <id>` - Basecamp project ID (required)
- `--cardtable <id>` - Basecamp card table ID (required)
- `--account <slug>` - Fizzy account slug (required)
- `--board <id>` - Existing Fizzy board ID
- `--create-board <name>` - Create new board with name
- `--migrate-comments` - Migrate card comments (slower)
- `--update-existing` - Update previously migrated cards
- `--dry-run` - Preview without making changes
- `--batch-size <number>` - Cards to process in parallel (default: 10)
- `--verbose` - Show detailed progress

## Examples

### Complete Migration Workflow

```bash
# 1. Check authentication
bf auth status

# 2. Authenticate if needed
bf auth basecamp
bf auth fizzy

# 3. Find your Basecamp project
bf list projects
# Output: Copy the project ID

# 4. Find the card table
bf list cardtables --project=123456
# Output: Copy the card table ID

# 5. Check Fizzy boards (optional - create new)
bf list boards

# 6. Run migration
bf migrate \
  --project=123456 \
  --cardtable=789012 \
  --account=/897362094 \
  --create-board="Migrated from Basecamp" \
  --migrate-comments \
  --verbose

# 7. Check results in Fizzy
bf list boards
```

### Testing Before Migration

```bash
# Always test with dry-run first!
bf migrate \
  --project=123456 \
  --cardtable=789012 \
  --account=/897362094 \
  --board=xyz123 \
  --dry-run \
  --verbose
```

### Incremental Migration

```bash
# First migration (without comments for speed)
bf migrate \
  --project=123456 \
  --cardtable=789012 \
  --account=/897362094 \
  --board=xyz123

# Later: add comments to existing cards
bf migrate \
  --project=123456 \
  --cardtable=789012 \
  --account=/897362094 \
  --board=xyz123 \
  --migrate-comments \
  --update-existing
```

## Configuration File

Location: `~/.bc-fizzy-migrate/config.json`

Structure:
```json
{
  "version": "1.0.0",
  "basecamp": {
    "account_id": "123456",
    "access_token": "...",
    "refresh_token": "...",
    "token_expires_at": 1234567890
  },
  "fizzy": {
    "access_token": "...",
    "default_account": {
      "id": "...",
      "name": "37signals",
      "slug": "/897362094"
    }
  },
  "mappings": {
    "users": {
      "basecamp_user_id": {
        "basecamp_email": "user@example.com",
        "fizzy_id": "...",
        "fizzy_email": "user@example.com",
        "mapped_at": "2025-02-04T..."
      }
    }
  }
}
```

## Troubleshooting

### Authentication Issues

```bash
# Check status
bf auth status

# Re-authenticate
bf auth basecamp
bf auth fizzy

# Reset everything
bf config reset
```

### Token Expired

```bash
# Basecamp tokens auto-refresh, but if issues:
bf auth basecamp

# Fizzy tokens need manual refresh:
bf auth fizzy
```

### Clear Configuration

```bash
# Nuclear option - start fresh
bf config reset
rm -rf ~/.bc-fizzy-migrate/
```

### Debug Mode

```bash
# Use verbose flag for detailed output
bf migrate --verbose ...
```

## Getting Help

```bash
# General help
bf --help

# Command-specific help
bf auth --help
bf list --help
bf migrate --help
bf config --help
```

## Environment Variables

Create `.env` file in project root:

```bash
# Basecamp OAuth
# Get credentials from: https://launchpad.37signals.com/integrations
BASECAMP_CLIENT_ID=your_client_id_here
BASECAMP_CLIENT_SECRET=your_client_secret_here
BASECAMP_REDIRECT_URI=http://localhost:8000/auth/callback

# API URLs
BASECAMP_API_URL=https://3.basecampapi.com
FIZZY_API_URL=https://app.fizzy.do

# Rate Limits (requests per second)
BASECAMP_RATE_LIMIT=5
FIZZY_RATE_LIMIT=5
```

## Files & Directories

```
~/.bc-fizzy-migrate/
├── config.json           # Configuration & tokens
└── migrations/           # Migration state files
    └── mig_*.json       # Individual migration records
```

## Tips

1. **Always use `--dry-run` first** to preview changes
2. **Start without `--migrate-comments`** for faster initial migration
3. **Use smaller `--batch-size`** if experiencing rate limits
4. **Check `bf auth status`** regularly for token expiry
5. **User mappings are cached** - reused across migrations
6. **Cards are tagged** with `basecamp-{id}` to prevent duplicates
7. **Use `--verbose`** to see detailed progress

## API Rate Limits

- Basecamp: 5 requests/second (built-in limiting)
- Fizzy: 5 requests/second (built-in limiting)
- Automatic retry with exponential backoff
- Respects 429 Retry-After headers

## Migration Behavior

### What Gets Migrated
- ✅ Card title
- ✅ Card description/content
- ✅ Card assignees (if mapped)
- ✅ Card steps (checklist items)
- ✅ Card completion status
- ✅ Card column placement
- ✅ Comments (if `--migrate-comments`)

### What Doesn't Get Migrated
- ❌ Card attachments (files)
- ❌ Card timestamps (uses migration date)
- ❌ Step assignees (Fizzy doesn't support)
- ❌ Comment reactions
- ❌ Card history/audit log

### Column Mapping
- `Triage` → Fizzy "Maybe?" (triage status)
- `Not Now` → "Not Now" status
- `Done` → Closed status
- Custom columns → Auto-created or matched by name

### User Mapping
- Auto-match by email address
- Prompt for confirmation
- Manual selection for non-matches
- Can skip (card gets no assignee)
- Cached for future use

## Need More Help?

Check these files:
- `/Users/mulder/Sites/opencode/basecamp_x_fizzy/cli/PROJECT_STATUS.md`
- `/Users/mulder/Sites/opencode/basecamp_x_fizzy/cli/README.md` (if exists)
