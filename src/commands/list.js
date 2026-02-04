import chalk from 'chalk';
import { loadConfig, isBasecampAuthenticated, isFizzyAuthenticated, getContext } from '../config/config-manager.js';
import { BasecampClient } from '../clients/basecamp-client.js';
import { FizzyClient } from '../clients/fizzy-client.js';
import { listMigrations } from '../state/migration-state.js';
import * as logger from '../utils/logger.js';
import { showContextBanner } from '../utils/context-helper.js';
import Table from 'cli-table3';

/**
 * Handle list command
 * @param {string} resource - Resource type to list
 * @param {Object} options - Command options
 */
export async function listCommand(resource, options) {
  try {
    const config = await loadConfig();
    const context = options.context === false ? {} : getContext(config);
    
    // Show context banner (only if using context and not listing migrations)
    if (options.context !== false && resource !== 'migrations') {
      showContextBanner(context);
    }
    
    const normalizedResource = resource.toLowerCase();

    switch (normalizedResource) {
      case 'projects':
        await listProjects(config);
        break;
      case 'cardtables':
        // Use context if --project not provided and context not disabled
        const projectId = options.project || (options.context !== false ? context.project_id : null);
        if (!projectId) {
          logger.error('--project <id> is required (or set with: bf use project <id>)');
          process.exit(1);
        }
        await listCardTables(config, projectId);
        break;
      case 'boards':
        await listBoards(config, options.account || (options.context !== false ? context.account_slug : null));
        break;
      case 'columns':
        // Use context if options not provided and context not disabled
        const accountSlug = options.account || (options.context !== false ? context.account_slug : null);
        const boardId = options.board || (options.context !== false ? context.board_id : null);
        if (!accountSlug || !boardId) {
          logger.error('--account <slug> and --board <id> are required (or set with: bf use account/board)');
          process.exit(1);
        }
        await listColumns(config, accountSlug, boardId);
        break;
      case 'migrations':
        await listMigrationsCommand();
        break;
      default:
        logger.error(`Unknown resource: ${resource}`);
        logger.info('Valid resources: projects, cardtables, boards, columns, migrations');
        process.exit(1);
    }
  } catch (error) {
    logger.error('List command failed', error);
    process.exit(1);
  }
}

/**
 * List Basecamp projects
 */
async function listProjects(config) {
  if (!isBasecampAuthenticated(config)) {
    logger.error('Not authenticated with Basecamp');
    logger.info('Run: bf auth basecamp');
    process.exit(1);
  }

  logger.header('📋 Basecamp Projects');
  const spinner = logger.createSpinner('Fetching projects...');
  spinner.start();

  const client = new BasecampClient(config.basecamp);
  const projects = await client.getProjects();

  spinner.stop();

  if (projects.length === 0) {
    logger.warn('No projects found');
    return;
  }

  const table = new Table({
    head: [chalk.cyan('ID'), chalk.cyan('Name'), chalk.cyan('Status'), chalk.cyan('Description')],
    colWidths: [15, 30, 15, 40],
    style: {
      head: [],
      border: ['gray']
    },
    wordWrap: true
  });

  projects.forEach(project => {
    table.push([
      project.id.toString(),
      project.name,
      project.status,
      project.description || chalk.gray('(no description)')
    ]);
  });

  console.log(table.toString());
  console.log('');
  logger.info(`Total: ${projects.length} projects`);
  logger.info(`\nNext: ${chalk.cyan('bf use project <id>')} or ${chalk.cyan('bf list cardtables --project=<id>')}\n`);
}

/**
 * List card tables in a project
 */
async function listCardTables(config, projectId) {
  if (!isBasecampAuthenticated(config)) {
    logger.error('Not authenticated with Basecamp');
    logger.info('Run: bf auth basecamp');
    process.exit(1);
  }

  const context = getContext(config);
  const projectName = context.project_id === projectId ? context.project_name : null;
  const headerText = projectName ? `📊 Card Tables in ${projectName}` : `📊 Card Tables in Project ${projectId}`;
  
  logger.header(headerText);
  const spinner = logger.createSpinner('Fetching card tables...');
  spinner.start();

  const client = new BasecampClient(config.basecamp);
  const project = await client.getProject(projectId);

  spinner.stop();

  // Find card tables in the project dock
  // Card tables are named 'kanban_board' in the Basecamp API
  const cardTables = project.dock?.filter(item => item.name === 'kanban_board') || [];

  if (cardTables.length === 0) {
    logger.warn('No card tables found in this project');
    return;
  }

  const table = new Table({
    head: [chalk.cyan('ID'), chalk.cyan('Title'), chalk.cyan('URL')],
    colWidths: [15, 40, 50],
    style: {
      head: [],
      border: ['gray']
    },
    wordWrap: true
  });

  cardTables.forEach(ct => {
    table.push([
      ct.id.toString(),
      ct.title,
      ct.url
    ]);
  });

  console.log(table.toString());
  console.log('');
  logger.info(`Total: ${cardTables.length} card tables`);
  logger.info(`\nNext: ${chalk.cyan('bf migrate --project=' + projectId + ' --cardtable=<id> ...')}\n`);
}

/**
 * List Fizzy boards
 */
async function listBoards(config, accountSlug) {
  if (!isFizzyAuthenticated(config)) {
    logger.error('Not authenticated with Fizzy');
    logger.info('Run: bf auth fizzy');
    process.exit(1);
  }

  const slug = accountSlug || config.fizzy.default_account?.slug;
  if (!slug) {
    logger.error('No account specified and no default account set');
    process.exit(1);
  }

  logger.header(`📋 Fizzy Boards (${slug})`);
  const spinner = logger.createSpinner('Fetching boards...');
  spinner.start();

  const client = new FizzyClient(config.fizzy);
  const boards = await client.getBoards(slug);

  spinner.stop();

  if (boards.length === 0) {
    logger.warn('No boards found');
    return;
  }

  const table = new Table({
    head: [chalk.cyan('ID'), chalk.cyan('Name'), chalk.cyan('Cards'), chalk.cyan('Created')],
    colWidths: [30, 35, 10, 25],
    style: {
      head: [],
      border: ['gray']
    },
    wordWrap: true
  });

  boards.forEach(board => {
    table.push([
      board.id,
      board.name,
      board.card_count?.toString() || '0',
      new Date(board.created_at).toLocaleDateString()
    ]);
  });

  console.log(table.toString());
  console.log('');
  logger.info(`Total: ${boards.length} boards`);
  logger.info(`\nNext: ${chalk.cyan('bf list columns --account=' + slug + ' --board=<id>')}\n`);
}

/**
 * List columns in a board
 */
async function listColumns(config, accountSlug, boardId) {
  if (!isFizzyAuthenticated(config)) {
    logger.error('Not authenticated with Fizzy');
    logger.info('Run: bf auth fizzy');
    process.exit(1);
  }

  logger.header(`📊 Columns in Board ${boardId}`);
  const spinner = logger.createSpinner('Fetching columns...');
  spinner.start();

  const client = new FizzyClient(config.fizzy);
  const columns = await client.getColumns(accountSlug, boardId);

  spinner.stop();

  if (columns.length === 0) {
    logger.warn('No columns found');
    return;
  }

  const table = new Table({
    head: [chalk.cyan('ID'), chalk.cyan('Name'), chalk.cyan('Color'), chalk.cyan('Position')],
    colWidths: [30, 30, 30, 10],
    style: {
      head: [],
      border: ['gray']
    },
    wordWrap: true
  });

  columns.forEach(column => {
    table.push([
      column.id,
      column.name,
      column.color || chalk.gray('default'),
      column.position?.toString() || 'N/A'
    ]);
  });

  console.log(table.toString());
  console.log('');
  logger.info(`Total: ${columns.length} columns\n`);
}

/**
 * List all migrations
 */
async function listMigrationsCommand() {
  logger.header('📊 Migrations');
  
  const migrations = await listMigrations();
  
  if (migrations.length === 0) {
    logger.warn('No migrations found');
    logger.info('\nRun a migration with: bf migrate\n');
    return;
  }
  
  const table = new Table({
    head: [chalk.cyan('Migration ID'), chalk.cyan('Status'), chalk.cyan('Project'), chalk.cyan('Board'), chalk.cyan('Progress'), chalk.cyan('Started')],
    colWidths: [20, 12, 25, 25, 15, 20],
    style: {
      head: [],
      border: ['gray']
    },
    wordWrap: true
  });
  
  migrations.forEach(m => {
    const progressStr = `${m.progress.successful_cards}/${m.progress.processed_cards}`;
    const statusColor = m.status === 'completed' ? chalk.green : 
                        m.status === 'failed' ? chalk.red : 
                        m.status === 'partial' ? chalk.yellow : 
                        chalk.blue;
    
    table.push([
      m.migration_id,
      statusColor(m.status),
      m.source_project || 'Unknown',
      m.target_board || 'Unknown',
      progressStr,
      new Date(m.started_at).toLocaleString()
    ]);
  });
  
  console.log(table.toString());
  console.log('');
  logger.info(`Total: ${migrations.length} migrations`);
  logger.info(`\nResume a migration: ${chalk.cyan('bf resume <migration-id>')}\n`);
}
