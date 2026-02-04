# Basecamp → Fizzy Migration CLI

A complete Node.js CLI tool for migrating Basecamp 4 card tables to Fizzy boards with intelligent duplicate detection, user mapping, and full data preservation.

## Features

- 🔐 **OAuth 2.0 Authentication** - Secure authentication for both Basecamp and Fizzy
- 🎯 **Smart Column Mapping** - Auto-detects and creates missing columns, reuses existing ones
- 👥 **Interactive User Mapping** - Auto-matches by email with manual override options
- 🔄 **Duplicate Detection** - Prevents re-importing cards using description markers
- 📊 **Complete Data Migration** - Cards, steps, comments, assignees, and metadata
- ⚡ **Batch Processing** - Configurable parallel processing with rate limiting
- 💾 **State Persistence** - Resume failed migrations from where they stopped
- 🎨 **Rich CLI Interface** - Colored output, progress indicators, and detailed summaries
- 🏷️ **Context Management** - Remember projects, boards, and accounts between commands

## Installation

```bash
# Clone the repository
git clone git@github.com:labelvier/basecamp-fizzy-migrate.git
cd basecamp-fizzy-migrate

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env and add your Basecamp OAuth credentials

# Link globally
npm link
```

This creates two global aliases:
- `bf` (recommended short form)
- `bc-fizzy-migrate` (full command)

### Getting Basecamp OAuth Credentials

1. Go to https://launchpad.37signals.com/integrations
2. Create a new integration
3. Set redirect URI to: `http://localhost:8000/auth/callback`
4. Copy Client ID and Client Secret to your `.env` file

## Quick Start

### 1. Authentication

```bash
# Authenticate with Basecamp (OAuth 2.0)
bf auth basecamp

# Authenticate with Fizzy (Personal Access Token)
bf auth fizzy

# Check authentication status
bf auth status
```

### 2. Set Context (Optional but Recommended)

```bash
# List and select your project
bf list projects
bf use project <project-id>

# List and select card table
bf list cardtables
bf use cardtable <cardtable-id>

# List and select Fizzy account
bf list boards
bf use account <account-slug>
```

### 3. Run Migration

```bash
# Create a new board and migrate
bf migrate --create-board="My Migrated Board"

# Or migrate to existing board
bf migrate --board=<board-id>

# With options
bf migrate --create-board="My Board" --yes --skip-user-mapping --batch-size=5
```

## Command Reference

### Authentication

```bash
bf auth basecamp              # OAuth flow for Basecamp
bf auth fizzy                 # Token-based auth for Fizzy
bf auth status                # Show current auth status
```

### Context Management

```bash
bf use project <id>           # Set current project
bf use cardtable <id>         # Set current card table
bf use account <slug>         # Set current Fizzy account
bf use board <id>             # Set current Fizzy board
bf use clear                  # Clear all context
bf use                        # Show current context
```

### Listing Resources

```bash
bf list projects              # All Basecamp projects
bf list cardtables            # Card tables in current project
bf list boards                # Fizzy boards in current account
bf list columns --board=<id>  # Columns in a board
bf list migrations            # All migration history
```

### Migration

```bash
bf migrate [options]

Options:
  --project <id>              Basecamp project ID (or use context)
  --cardtable <id>            Basecamp card table ID (or use context)
  --account <slug>            Fizzy account slug (or use context)
  --board <id>                Existing Fizzy board ID (or use context)
  --create-board <name>       Create new board with this name
  --migrate-comments          Migrate card comments (slower)
  --update-existing           Update previously migrated cards
  --skip-user-mapping         Skip interactive user mapping
  -y, --yes                   Skip confirmation prompts
  --dry-run                   Preview without making changes
  --batch-size <number>       Cards to process in parallel (default: 10)
  --no-context                Ignore current context
```

### Resume Migration

```bash
bf resume <migration-id>      # Show details or resume failed migration
```

### User Mapping

```bash
bf map-users --project=<id> --account=<slug>
```

Interactive mapping of Basecamp users to Fizzy users with:
- Auto-matching by email
- Manual selection for unmatched users
- Saved mappings for future migrations

### Configuration

```bash
bf config show                # Show config (tokens masked)
bf config reset               # Reset all configuration
```

## Migration Workflow

The migration process has 5 phases:

### Phase 1: Discovery & Validation
- Fetches card table and board details
- Counts cards in all columns
- Creates migration state

### Phase 2: Column Mapping & Setup
- Detects special columns (Triage, Not Now, Done)
- Finds existing Fizzy columns by name
- Creates missing columns with color mapping
- Maps Basecamp columns to Fizzy actions

### Phase 3: User Mapping
- Fetches Basecamp and Fizzy users
- Auto-matches users by email
- Interactive prompts for unmapped users (optional)

### Phase 4: Card Migration
- Scans for previously migrated cards (duplicate detection)
- Processes cards in batches
- For each card:
  - Transforms card data
  - Creates in Fizzy with `#basecamp-id-{id}` marker
  - Places in correct column
  - Assigns users
  - Adds steps
  - Closes if completed
  - Migrates comments (optional)
- Saves state after each batch

### Phase 5: Finalization
- Marks migration as completed/partial/failed
- Displays comprehensive summary

## Special Features

### Duplicate Detection

Cards are tracked using a description marker: `#basecamp-id-{id}`

- Placed at the end of card descriptions
- Minimal visual impact
- Enables reliable duplicate detection
- No tag pollution

When re-running a migration:
```bash
✓ Found 6 previously migrated cards
Skipped: 6
```

### Long Title Handling

Titles longer than 255 characters are automatically handled:
- First 255 characters become the title
- Remaining text is prepended to the description
- No data loss

### Column Mapping

Special Basecamp column types are intelligently mapped:

| Basecamp Column | Fizzy Action | Behavior |
|----------------|--------------|----------|
| Triage | `keep_triage` | Stays in "Maybe?" |
| Not Now Column | `not_now` | Moves to "Not Now" |
| Done Column | `close` | Closes card |
| Regular Column | `triage_to_column` | Moves to specific column |

### Color Mapping

Basecamp colors are mapped to Fizzy colors:

```javascript
purple → var(--color-card-7)
orange → var(--color-card-3)
blue   → var(--color-card-default)
gray   → var(--color-card-1)
pink   → var(--color-card-8)
yellow → var(--color-card-2)
green  → var(--color-card-4)
red    → var(--color-card-5)
```

### Rate Limiting

Built-in intelligent rate limiting:
- Token bucket algorithm
- 5 requests/second for both APIs
- Exponential backoff on 429 errors
- Automatic retry (max 3 attempts)

## Configuration

Config is stored in `~/.bc-fizzy-migrate/`

```
~/.bc-fizzy-migrate/
├── config.json          # Auth tokens, context, user mappings
└── migrations/
    └── mig_*.json      # Migration state files
```

### config.json Structure

```json
{
  "basecamp": {
    "access_token": "...",
    "refresh_token": "...",
    "expires_at": "2026-02-18T15:24:46.000Z",
    "accounts": [...]
  },
  "fizzy": {
    "access_token": "...",
    "default_account": "/6098048"
  },
  "context": {
    "project_id": "45810311",
    "project_name": "Hardloopnetwerk.nl",
    "cardtable_id": "9501082228",
    "account_slug": "/6098048",
    "board_id": "03fj2kqaf8omjnck951bfze1y"
  },
  "user_mappings": {
    "123456": {
      "basecamp_id": "123456",
      "basecamp_email": "user@example.com",
      "basecamp_name": "User Name",
      "fizzy_id": "abc123",
      "fizzy_email": "user@example.com",
      "fizzy_name": "User Name",
      "mapped_at": "2026-02-04T16:15:00.000Z"
    }
  }
}
```

## Usage Examples

### Basic Migration

```bash
# Authenticate
bf auth basecamp
bf auth fizzy

# Set context
bf use project 45810311
bf use cardtable 9501082228
bf use account /6098048

# Migrate
bf migrate --create-board="Migrated from Basecamp"
```

### Non-Interactive Migration (for scripts)

```bash
bf migrate \
  --project=45810311 \
  --cardtable=9501082228 \
  --account=/6098048 \
  --create-board="Automated Migration" \
  --yes \
  --skip-user-mapping \
  --batch-size=5
```

### Migration with Comments

```bash
bf migrate \
  --create-board="Complete Migration" \
  --migrate-comments \
  --batch-size=2
```

### Dry Run

```bash
bf migrate --create-board="Test Board" --dry-run
```

### Update Existing Cards

```bash
bf migrate --board=03fj2kqaf8omjnck951bfze1y --update-existing
```

## API Endpoints

### Basecamp API

```
Base URL: https://3.basecampapi.com/{account_id}

GET  /projects.json
GET  /projects/{id}.json
GET  /buckets/{project_id}/card_tables/{id}.json
GET  /buckets/{project_id}/card_tables/lists/{column_id}/cards.json
GET  /buckets/{project_id}/cards/{id}.json
GET  /buckets/{project_id}/recordings/{card_id}/comments.json
GET  /projects/{project_id}/people.json
```

### Fizzy API

```
Base URL: https://api.fizzy.do

GET    /my/identity
GET    /{account}/boards
GET    /{account}/boards/{id}
POST   /{account}/boards
GET    /{account}/boards/{board_id}/columns
POST   /{account}/boards/{board_id}/columns
GET    /{account}/cards?board_ids[]={id}
GET    /{account}/cards/{number}
POST   /{account}/boards/{board_id}/cards
PATCH  /{account}/cards/{number}
POST   /{account}/cards/{number}/triage
POST   /{account}/cards/{number}/closure
POST   /{account}/cards/{number}/not_now
POST   /{account}/cards/{number}/steps
PATCH  /{account}/cards/{number}/steps/{id}
POST   /{account}/cards/{number}/comments
GET    /{account}/tags
GET    /{account}/users
POST   /{account}/cards/{number}/assignments
```

## Troubleshooting

### Authentication Issues

```bash
# Clear config and re-authenticate
bf config reset
bf auth basecamp
bf auth fizzy
```

### Migration Stuck

Check migration state:
```bash
bf list migrations
bf resume <migration-id>
```

### Rate Limit Errors

The tool handles rate limiting automatically with exponential backoff. If you see persistent rate limit errors:
- Reduce batch size: `--batch-size=2`
- Wait a few minutes and resume the migration

### Duplicate Cards Created

This shouldn't happen with the new system, but if it does:
- Cards created with the new system have `#basecamp-id-{id}` in descriptions
- Run the migration again with the same board - it will skip existing cards

### Missing Users

If users aren't being mapped:
1. Check Fizzy API returns email addresses
2. Use interactive mapping: remove `--skip-user-mapping`
3. Manually map users: `bf map-users --project=<id> --account=<slug>`

## Development

### Project Structure

```
cli/
├── src/
│   ├── cli.js                    # Main CLI entry point
│   ├── auth/
│   │   ├── basecamp-oauth.js     # Basecamp OAuth 2.0 flow
│   │   └── fizzy-token.js        # Fizzy token auth
│   ├── clients/
│   │   ├── basecamp-client.js    # Basecamp API client
│   │   ├── fizzy-client.js       # Fizzy API client
│   │   └── rate-limiter.js       # Token bucket rate limiter
│   ├── commands/
│   │   ├── auth.js               # Auth commands
│   │   ├── config.js             # Config commands
│   │   ├── list.js               # List commands
│   │   ├── use.js                # Context commands
│   │   ├── map-users.js          # User mapping command
│   │   ├── migrate.js            # Main migration command
│   │   └── resume.js             # Resume command
│   ├── config/
│   │   ├── config-manager.js     # Config CRUD operations
│   │   └── defaults.js           # Default settings
│   ├── mappers/
│   │   ├── card-mapper.js        # Card transformation
│   │   ├── status-mapper.js      # Column/color mapping
│   │   └── html-converter.js     # HTML content processor
│   ├── services/
│   │   ├── column-mapper.js      # Column detection & creation
│   │   ├── user-mapper.js        # User auto-matching
│   │   └── migration.js          # Main orchestrator (5 phases)
│   ├── state/
│   │   └── migration-state.js    # State persistence
│   └── utils/
│       ├── logger.js             # Colored logging
│       ├── errors.js             # Custom error classes
│       ├── validators.js         # Validation helpers
│       └── context-helper.js     # Context formatting
├── package.json
├── .env.example
└── README.md
```

### Testing

```bash
# Test with dry run
bf migrate --create-board="Test" --dry-run

# Test duplicate detection
bf migrate --create-board="Test Duplicates"
bf migrate --board=<same-board-id>  # Should skip all cards
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Basecamp OAuth
BASECAMP_CLIENT_ID=your_client_id
BASECAMP_CLIENT_SECRET=your_client_secret
BASECAMP_REDIRECT_URI=http://localhost:3000/callback

# Server
PORT=3000
```

## Version History

### v1.0.0 (Current)
- ✅ Full OAuth 2.0 authentication for Basecamp
- ✅ Token-based authentication for Fizzy
- ✅ Complete card migration with steps and comments
- ✅ Smart column detection and creation
- ✅ Interactive user mapping with auto-matching
- ✅ Duplicate detection using description markers
- ✅ Long title handling (overflow to description)
- ✅ Batch processing with rate limiting
- ✅ State persistence and resume capability
- ✅ Context management
- ✅ Rich CLI with colored output
- ✅ Comprehensive error handling

## License

MIT

## Author

Label Vier

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review migration logs in `~/.bc-fizzy-migrate/migrations/`
3. Run with `--dry-run` to preview without changes
4. Use `bf resume <migration-id>` to inspect failed migrations
