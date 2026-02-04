# Basecamp → Fizzy Migration CLI - Project Status

## ✅ CLI Tool is Functional!

The CLI tool is now **installed globally** and ready to use:
- Command aliases: `bf` or `bc-fizzy-migrate`
- Location: `/Users/mulder/Sites/opencode/basecamp_x_fizzy/cli`

## Quick Test

```bash
# Check version
bf --version

# Check authentication status
bf auth status

# Show help
bf --help
bf auth --help
bf list --help
bf migrate --help
```

---

## 📁 Completed Files (17 files)

### Core Infrastructure ✅
1. **package.json** - Dependencies installed, bin aliases configured
2. **.gitignore** - Excludes node_modules, .env, config, logs
3. **.env.example** - Pre-configured Basecamp OAuth credentials
4. **src/cli.js** - Main CLI entry point with Commander.js ✅ EXECUTABLE

### Configuration System ✅
5. **src/config/defaults.js** - API URLs, OAuth settings, rate limits
6. **src/config/config-manager.js** - Config CRUD operations

### Utilities ✅
7. **src/utils/logger.js** - Colored logging with spinners & progress bars
8. **src/utils/errors.js** - Custom error classes
9. **src/utils/validators.js** - Validation & helper functions

### API Clients ✅
10. **src/clients/rate-limiter.js** - Token bucket rate limiting + retry logic
11. **src/clients/basecamp-client.js** - Full Basecamp API client with OAuth refresh
12. **src/clients/fizzy-client.js** - Full Fizzy API client with all endpoints

### Authentication ✅
13. **src/auth/basecamp-oauth.js** - OAuth 2.0 flow with Express callback server
14. **src/auth/fizzy-token.js** - Personal access token validation

### Commands ✅
15. **src/commands/auth.js** - `bf auth basecamp|fizzy|status`
16. **src/commands/config.js** - `bf config show|reset`
17. **src/commands/list.js** - `bf list projects|cardtables|boards|columns`

### Placeholder Commands (Not Implemented Yet)
18. **src/commands/map-users.js** - User mapping (placeholder)
19. **src/commands/migrate.js** - Main migration (placeholder)
20. **src/commands/resume.js** - Resume migration (placeholder)

---

## 🎯 Working Features

### ✅ Authentication Commands
```bash
# Authenticate with Basecamp (OAuth 2.0)
bf auth basecamp
# → Opens browser for OAuth
# → Exchanges code for tokens
# → Stores in ~/.bc-fizzy-migrate/config.json

# Authenticate with Fizzy (Personal Access Token)
bf auth fizzy
# → Prompts for token
# → Validates with API
# → Prompts to select default account
# → Stores in config

# Check authentication status
bf auth status
# → Shows table with auth status for both services
# → Shows expiry dates, account info
```

### ✅ List Commands
```bash
# List Basecamp projects
bf list projects

# List card tables in a project
bf list cardtables --project=123456

# List Fizzy boards
bf list boards
bf list boards --account=/897362094

# List columns in a board
bf list columns --account=/897362094 --board=xyz123
```

### ✅ Config Management
```bash
# Show current config (tokens masked)
bf config show

# Reset config to defaults
bf config reset
```

---

## 🚧 Still To Build (Priority Order)

### Phase 1: Mappers & Services (NEXT)

#### 1. **src/mappers/card-mapper.js**
Transform Basecamp card → Fizzy card format
- Map card fields (title, description, status)
- Map assignees (filter unmapped users)
- Map steps (content + completed state)
- Handle completed cards

#### 2. **src/mappers/html-converter.js**
Process HTML content (v1: pass-through)
- Currently: return as-is, let Fizzy sanitize

#### 3. **src/mappers/status-mapper.js**
Map Basecamp columns → Fizzy actions
- Map colors (purple → var(--color-card-7), etc.)
- Triage → "Maybe?" status
- Not Now → "Not Now"
- Done → Closed
- Custom → Create column

#### 4. **src/services/user-mapper.js**
Interactive user mapping
- Auto-match by email
- Prompt for confirmation
- Manual selection fallback
- Store mappings in config
- Reuse across migrations

#### 5. **src/services/column-mapper.js**
Column mapping + auto-creation
- Detect special columns (Triage, Not Now, Done)
- Find existing columns by name
- Create missing columns
- Return action mappings

### Phase 2: Migration Orchestrator (CORE)

#### 6. **src/services/migration.js**
Main migration orchestration
- **Phase 1: Discovery** - Fetch card table, board, existing cards
- **Phase 2: Column Setup** - Map/create columns
- **Phase 3: User Mapping** - Interactive mapping if needed
- **Phase 4: Card Migration** - Batch process cards
  - Transform card data
  - Create in Fizzy
  - Add `basecamp-{id}` tag (CRITICAL for duplicate prevention)
  - Place in column (triage/notNow/close/column)
  - Assign users
  - Add steps
  - Close if completed
  - Migrate comments (optional)
- **Phase 5: Finalization** - Save state, show report

**Key Functions:**
```javascript
runMigration(options)
phase1_discovery(migration)
phase2_columns(migration)
phase3_users(migration)
phase4_cards(migration, options)
phase5_finalize(migration)
migrateCard(basecampCard, migration, options)
placeCardInColumn(fizzyCard, columnMapping, migration)
migrateComments_forCard(basecampCard, fizzyCard, migration)
findExistingMigratedCards(accountSlug, boardId, fizzyClient)
```

### Phase 3: State Management

#### 7. **src/state/migration-state.js**
Migration state persistence
- Create migration state object
- Save after each batch
- Load for resume functionality

### Phase 4: Command Implementation

#### 8. Update **src/commands/migrate.js**
Full migration command implementation
- Validate authentication
- Validate options
- Create board if requested
- Call runMigration()
- Print detailed report

#### 9. Update **src/commands/map-users.js**
Interactive user mapping command
- Fetch users from both services
- Load existing mappings
- Run interactive mapping
- Save to config

#### 10. Update **src/commands/resume.js**
Resume failed migrations
- Load migration state
- Show current progress
- Continue from where it stopped

---

## 🔑 Key Technical Details

### Authentication
- **Basecamp:** OAuth 2.0 with Express callback server on localhost:8000
- **Fizzy:** Personal access token from https://app.fizzy.do/settings/tokens
- **Storage:** `~/.bc-fizzy-migrate/config.json`

### Rate Limiting
- Both APIs: 5 requests/second (token bucket)
- Exponential backoff on errors
- 429 handling with Retry-After header
- Max 3 retries (skip 4xx except 429)

### Duplicate Prevention (CRITICAL)
- Tag each migrated card: `basecamp-{basecamp_card_id}`
- Scan existing tags before migration
- Skip cards with matching tags
- Optional `--update-existing` flag

### Pagination
- Both APIs use Link headers with `rel="next"`
- Async generators for memory efficiency

### Error Handling
- Custom error classes (AuthenticationError, ApiError, etc.)
- Graceful failures, continue processing
- Log failures to migration state
- Save state after each batch for resume

---

## 📊 API Clients Status

### BasecampClient ✅
- ✅ getProjects()
- ✅ getProject(projectId)
- ✅ getCardTable(projectId, cardTableId)
- ✅ getCards(projectId, columnId, options)
- ✅ getCard(projectId, cardId)
- ✅ getComments(projectId, cardId)
- ✅ getPeople(projectId)
- ✅ paginateCards(projectId, columnId) - async generator
- ✅ getAllCardsFromColumn(projectId, columnId)
- ✅ refreshAccessToken() - auto token refresh on 401

### FizzyClient ✅
- ✅ getIdentity()
- ✅ getBoards(accountSlug)
- ✅ getBoard(accountSlug, boardId)
- ✅ createBoard(accountSlug, data)
- ✅ getColumns(accountSlug, boardId)
- ✅ createColumn(accountSlug, boardId, data)
- ✅ getCards(accountSlug, filters)
- ✅ getCard(accountSlug, cardNumber)
- ✅ createCard(accountSlug, boardId, data)
- ✅ updateCard(accountSlug, cardNumber, data)
- ✅ triageCard(accountSlug, cardNumber, columnId)
- ✅ closeCard(accountSlug, cardNumber)
- ✅ notNowCard(accountSlug, cardNumber)
- ✅ createStep(accountSlug, cardNumber, data)
- ✅ updateStep(accountSlug, cardNumber, stepId, data)
- ✅ createComment(accountSlug, cardNumber, data)
- ✅ getTags(accountSlug)
- ✅ addTag(accountSlug, cardNumber, tagTitle)
- ✅ getUsers(accountSlug)
- ✅ assignUser(accountSlug, cardNumber, assigneeId)
- ✅ paginateCards(accountSlug, filters) - async generator

---

## 🧪 Testing

### Manual Testing
```bash
# Test CLI installation
bf --version
bc-fizzy-migrate --version

# Test authentication flow
bf auth status
bf auth basecamp  # Opens browser, requires user interaction
bf auth fizzy     # Prompts for token

# Test list commands (requires auth)
bf list projects
bf list cardtables --project=12345
bf list boards
bf list columns --account=/897362094 --board=xyz

# Test config
bf config show
bf config reset
```

### Unit Tests (To Be Written)
Location: `tests/unit/`
- Config manager tests
- Validator tests
- Rate limiter tests
- Mapper tests

### Integration Tests (To Be Written)
Location: `tests/integration/`
- API client tests (with nock)
- Full migration flow tests

---

## 📝 User Journey Example

```bash
# 1. Install (already done via npm link)
bf --version

# 2. Authenticate
bf auth basecamp  # Opens browser, OAuth flow
bf auth fizzy     # Enter token from Fizzy settings

# 3. Explore Basecamp
bf list projects
# → Copy project ID

bf list cardtables --project=123456
# → Copy card table ID

# 4. Explore Fizzy
bf list boards
# → Copy board ID or decide to create new

# 5. Run migration
bf migrate \
  --project=123456 \
  --cardtable=789012 \
  --account=/897362094 \
  --board=xyz123 \
  --migrate-comments \
  --batch-size=10

# 6. Resume if failed
bf resume mig_1234567890

# 7. Check config
bf config show
```

---

## 🎨 Color Mapping Reference

```javascript
BASECAMP_TO_FIZZY_COLORS = {
  'purple': 'var(--color-card-7)',
  'orange': 'var(--color-card-3)',
  'blue': 'var(--color-card-default)',
  'gray': 'var(--color-card-1)',
  'pink': 'var(--color-card-8)',
  'yellow': 'var(--color-card-2)',
  'green': 'var(--color-card-4)',
  'red': 'var(--color-card-5)'
}
```

---

## 🔒 Security Notes

1. **Tokens are stored locally** in `~/.bc-fizzy-migrate/config.json`
2. **Tokens are masked** when displayed with `bf config show`
3. **OAuth credentials are pre-configured** in .env.example
4. **NEVER commit** .env or config.json to git
5. **Basecamp tokens auto-refresh** when expired (handled by client)

---

## 🐛 Known Issues / Todos

1. **Token expiry handling** for Fizzy tokens (no refresh flow, user must re-auth)
2. **Migration state serialization** - Map objects need special handling
3. **Progress bar** - May need adjustment for large migrations
4. **Error recovery** - Need comprehensive testing of failure scenarios
5. **Basecamp card steps with assignees** - Fizzy steps don't support assignees

---

## 📚 Dependencies Installed

### Production
- commander@^11.1.0 - CLI framework
- axios@^1.6.5 - HTTP client
- inquirer@^9.2.12 - Interactive prompts
- chalk@^5.3.0 - Terminal colors
- ora@^8.0.1 - Spinners
- dotenv@^16.3.1 - Environment variables
- express@^4.18.2 - OAuth callback server
- open@^10.0.3 - Open browser
- cheerio@^1.0.0-rc.12 - HTML parsing (future use)
- cli-table3@^0.6.3 - Tables
- date-fns@^3.2.0 - Date formatting

### Development
- vitest@^1.2.0 - Testing framework
- nock@^13.5.0 - HTTP mocking
- eslint@^8.56.0 - Linting

---

## 🚀 Next Immediate Steps

1. **Implement mappers** (card, status, html)
2. **Implement services** (user-mapper, column-mapper)
3. **Implement migration orchestrator** (src/services/migration.js)
4. **Update migrate command** to use orchestrator
5. **Test with real data** (careful with dry-run first!)
6. **Write unit tests** for critical functions
7. **Write integration tests** with mocked APIs

---

## 💡 Development Tips

- Use `bf config show` to inspect current state
- Use `bf config reset` to clear authentication for fresh testing
- Use `--dry-run` flag when testing migration logic
- Use `--verbose` flag for detailed logging
- Check `~/.bc-fizzy-migrate/` for config and migration state files
- Use `npm link` to test changes immediately

---

## 📞 Support

For issues, check:
1. Authentication status: `bf auth status`
2. Config file: `bf config show`
3. Error logs in terminal output
4. Config location: `~/.bc-fizzy-migrate/config.json`

---

**Status:** CLI framework is complete and functional. Ready to implement core migration logic.

**Estimated completion:** 
- Mappers & Services: 2-3 hours
- Migration orchestrator: 4-6 hours
- Testing & refinement: 2-3 hours
- **Total:** ~10-12 hours of focused development

**Last updated:** February 4, 2025
