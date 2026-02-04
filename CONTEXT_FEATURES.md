# Context Management - Feature Update

## ✅ Alle Gevraagde Features Geïmplementeerd!

### 1. Pagination voor Projects ✅
**Probleem:** `bf list projects` toonde maar 15 resultaten  
**Oplossing:** Volledige paginatie met Link header parsing

**Resultaat:**
```bash
bf list projects
# Toont nu ALLE projects (bijv. 113 in plaats van 15)
```

---

### 2. Context Management met `bf use` ✅
**Feature:** Workflow context zodat je niet telkens IDs hoeft mee te geven

**Commands:**
```bash
# Toon huidige context
bf use

# Set project
bf use project 43050065
bf use project              # Interactive selection

# Set andere resources
bf use cardtable 12345
bf use board xyz789
bf use account /6098048

# Clear alles
bf use clear
```

**Voorbeeld workflow:**
```bash
# Oude manier (veel typen):
bf list cardtables --project=43050065
bf migrate --project=43050065 --cardtable=12345 --account=/6098048 --board=xyz

# Nieuwe manier (context):
bf use project 43050065
bf use cardtable 12345  
bf use account /6098048
bf list cardtables          # Gebruikt automatisch project!
bf migrate --board=xyz      # Gebruikt automatisch project, cardtable & account!
```

---

### 3. Context Banner ✅
**Feature:** Visuele indicator van huidige context

**Output:**
```bash
bf list cardtables
# [📁 Label Vier Support | 📊 Card Table 12345]
# 
# 📊 Card Tables in Label Vier Support
# ...
```

**Context icons:**
- 📁 Project
- 📊 Card Table
- 📋 Board
- 🏢 Account

---

### 4. `--no-context` Flag ✅
**Feature:** Negeer context en forceer expliciete parameters

**Gebruik:**
```bash
# Met context (gebruikt project uit context)
bf list cardtables

# Zonder context (vereist --project)
bf list cardtables --no-context --project=12345
```

**Use cases:**
- Tijdelijk ander project checken zonder context te wijzigen
- Scripts die niet van context afhankelijk moeten zijn
- Debug/troubleshooting

---

### 5. Interactive Selection ✅
**Feature:** Kies uit lijst wanneer geen ID gegeven

**Commands:**
```bash
bf use project     # Kies uit alle 113 projects
bf use board       # Kies uit alle boards
```

**Features:**
- Paginatie in selector (15 items per pagina)
- Zoeken met type-ahead
- Project naam + ID weergave

---

## Technische Details

### Config Structure
```json
{
  "context": {
    "project_id": "43050065",
    "project_name": "Label Vier Support",
    "cardtable_id": "12345",
    "board_id": null,
    "account_slug": "/6098048"
  }
}
```

### Nieuwe Files
1. **src/commands/use.js** - Use command implementation
2. **src/utils/context-helper.js** - Context formatting utilities

### Updated Files
1. **src/config/config-manager.js** - Context CRUD functions
2. **src/commands/list.js** - Context integration
3. **src/commands/migrate.js** - Context support
4. **src/clients/basecamp-client.js** - Full pagination
5. **src/cli.js** - Updated command definitions

### API Functions
```javascript
// Config manager
setProjectContext(id, name)
setCardTableContext(id)
setBoardContext(id)
setAccountContext(slug)
clearContext()
getContext(config)

// Context helpers
formatContextInfo(context)      // Format for display
showContextBanner(context)       // Print banner
hasContext(context)              // Check if any set
```

---

## Gebruik Voorbeelden

### Scenario 1: Nieuwe Migration
```bash
# Setup context
bf use project              # Interactive select
bf use cardtable 12345
bf use account /6098048

# Check context
bf use

# Run migration
bf migrate --create-board "Migrated Cards"
```

### Scenario 2: Explore Multiple Projects
```bash
# Set first project
bf use project 111
bf list cardtables

# Check other project WITHOUT changing context
bf list cardtables --project=222 --no-context

# Context still points to 111
bf use
```

### Scenario 3: Quick Check
```bash
# Current context
bf use

# Clear and start fresh
bf use clear

# Set everything at once
bf use project 43050065
bf use cardtable 12345
bf use account /6098048
bf use board xyz789
```

---

## Command Updates

### List Command
```bash
# Old (always required)
bf list cardtables --project=12345

# New (uses context)
bf use project 12345
bf list cardtables

# Override context
bf list cardtables --project=99999

# Ignore context
bf list cardtables --project=99999 --no-context
```

### Migrate Command
```bash
# Old (all required)
bf migrate \
  --project=12345 \
  --cardtable=67890 \
  --account=/123 \
  --board=xyz

# New (uses context)
bf use project 12345
bf use cardtable 67890
bf use account /123
bf migrate --board=xyz

# Or create new board
bf migrate --create-board "New Board"
```

---

## Tested & Working

```bash
✅ bf list projects          # 113 projects (full pagination)
✅ bf use                    # Show empty context
✅ bf use project 43050065   # Set project
✅ bf use cardtable 12345    # Set cardtable
✅ bf use account /6098048   # Set account
✅ bf use                    # Show full context
✅ bf list cardtables        # Uses context (shows banner)
✅ bf list cardtables --no-context --project=43050065  # No banner
✅ bf migrate --create-board "Test"  # Uses context, shows banner
✅ bf use clear             # Clear context
```

---

## Help Output

```bash
bf use --help

Usage: bc-fizzy-migrate use [options] [resource] [id]

Set or show current working context (project, board, etc)

Options:
  -h, --help  display help for command
```

```bash
bf list --help

Usage: bc-fizzy-migrate list [options] <resource>

List projects, boards, cardtables, or columns

Options:
  --project <id>    Basecamp project ID
  --cardtable <id>  Basecamp card table ID
  --account <slug>  Fizzy account slug (e.g., /897362094)
  --board <id>      Fizzy board ID
  --no-context      Ignore current context
  -h, --help        display help for command
```

---

## Benefits

### Developer Experience
1. ⚡ **Sneller werken** - Minder typen, geen ID's onthouden
2. 🎯 **Focus** - Context houdt bij waar je mee bezig bent
3. 👁️ **Zichtbaar** - Banner toont altijd waar je bent
4. 🔄 **Flexibel** - Override wanneer nodig met flags

### Production Ready
1. ✅ **Backwards compatible** - Oude --option syntax werkt nog
2. ✅ **Script friendly** - `--no-context` voor scripts
3. ✅ **Safe defaults** - Context per command type
4. ✅ **Clear errors** - Duidelijke meldingen wat ontbreekt

---

## Volgende Stap

Klaar om door te gaan met **migration logic implementatie**:
1. Mappers (card, status, HTML)
2. Services (user-mapper, column-mapper)
3. Migration orchestrator
4. Complete migrate command

Zeg "ja" om door te gaan! 🚀
