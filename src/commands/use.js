import chalk from 'chalk';
import inquirer from 'inquirer';
import { loadConfig, isBasecampAuthenticated, isFizzyAuthenticated, setProjectContext, setCardTableContext, setBoardContext, setAccountContext, clearContext, getContext } from '../config/config-manager.js';
import { BasecampClient } from '../clients/basecamp-client.js';
import { FizzyClient } from '../clients/fizzy-client.js';
import * as logger from '../utils/logger.js';
import Table from 'cli-table3';

/**
 * Handle use command
 * @param {string} resource - Resource type (project, board, account, etc)
 * @param {string} id - Resource ID or 'clear' to clear context
 */
export async function useCommand(resource, id) {
  try {
    const config = await loadConfig();

    // Handle clear command
    if (resource === 'clear' || id === 'clear') {
      await clearContext();
      logger.success('✓ Context cleared');
      return;
    }

    if (!id) {
      // No ID provided, show current context or interactive select
      await showOrSelectContext(config, resource);
      return;
    }

    const normalizedResource = resource ? resource.toLowerCase() : null;
    if (!normalizedResource) {
      logger.error('Resource type required');
      logger.info('Valid resources: project, cardtable, board, account');
      process.exit(1);
    }

    switch (normalizedResource) {
      case 'project':
        await useProject(config, id);
        break;
      case 'cardtable':
        await useCardTable(config, id);
        break;
      case 'board':
        await useBoard(config, id);
        break;
      case 'account':
        await useAccount(config, id);
        break;
      default:
        logger.error(`Unknown resource: ${resource}`);
        logger.info('Valid resources: project, cardtable, board, account');
        process.exit(1);
    }
  } catch (error) {
    logger.error('Use command failed', error);
    process.exit(1);
  }
}

/**
 * Show current context or allow interactive selection
 */
async function showOrSelectContext(config, resource) {
  const context = getContext(config);

  if (!resource) {
    // Show current context
    logger.header('📍 Current Context');

    const table = new Table({
      head: [chalk.cyan('Resource'), chalk.cyan('Value')],
      colWidths: [20, 60],
      style: {
        head: [],
        border: ['gray']
      }
    });

    table.push(
      ['Project', context.project_name ? `${context.project_name} (${context.project_id})` : chalk.gray('(not set)')],
      ['Card Table', context.cardtable_id || chalk.gray('(not set)')],
      ['Board', context.board_id || chalk.gray('(not set)')],
      ['Account', context.account_slug || chalk.gray('(not set)')]
    );

    console.log(table.toString());
    console.log('');
    logger.info('Usage:');
    logger.info('  bf use project <id>     - Set current project');
    logger.info('  bf use cardtable <id>   - Set current card table');
    logger.info('  bf use board <id>       - Set current board');
    logger.info('  bf use account <slug>   - Set current account');
    logger.info('  bf use clear            - Clear all context\n');
    return;
  }

  // Interactive selection
  switch (resource.toLowerCase()) {
    case 'project':
      await selectProject(config);
      break;
    case 'board':
      await selectBoard(config);
      break;
    default:
      logger.error('Interactive selection only available for: project, board');
      process.exit(1);
  }
}

/**
 * Set project context
 */
async function useProject(config, projectId) {
  if (!isBasecampAuthenticated(config)) {
    logger.error('Not authenticated with Basecamp');
    logger.info('Run: bf auth basecamp');
    process.exit(1);
  }

  const spinner = logger.createSpinner('Fetching project...');
  spinner.start();

  const client = new BasecampClient(config.basecamp);
  const project = await client.getProject(projectId);

  spinner.stop();

  await setProjectContext(project.id.toString(), project.name);

  logger.success(`✓ Using project: ${chalk.cyan(project.name)} (${project.id})`);
  logger.info(`\nNext: ${chalk.cyan('bf list cardtables')}\n`);
}

/**
 * Interactive project selection
 */
async function selectProject(config) {
  if (!isBasecampAuthenticated(config)) {
    logger.error('Not authenticated with Basecamp');
    logger.info('Run: bf auth basecamp');
    process.exit(1);
  }

  const spinner = logger.createSpinner('Fetching projects...');
  spinner.start();

  const client = new BasecampClient(config.basecamp);
  const projects = await client.getProjects();

  spinner.stop();

  if (projects.length === 0) {
    logger.warn('No projects found');
    return;
  }

  const choices = projects.map(p => ({
    name: `${p.name} (${p.id})`,
    value: p.id.toString()
  }));

  const { projectId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'projectId',
      message: 'Select project:',
      choices,
      pageSize: 15
    }
  ]);

  const project = projects.find(p => p.id.toString() === projectId);
  await setProjectContext(projectId, project.name);

  logger.success(`✓ Using project: ${chalk.cyan(project.name)} (${projectId})`);
  logger.info(`\nNext: ${chalk.cyan('bf list cardtables')}\n`);
}

/**
 * Set cardtable context
 */
async function useCardTable(config, cardTableId) {
  await setCardTableContext(cardTableId);
  logger.success(`✓ Using card table: ${cardTableId}`);
}

/**
 * Set board context
 */
async function useBoard(config, boardId) {
  await setBoardContext(boardId);
  logger.success(`✓ Using board: ${boardId}`);
}

/**
 * Interactive board selection
 */
async function selectBoard(config) {
  if (!isFizzyAuthenticated(config)) {
    logger.error('Not authenticated with Fizzy');
    logger.info('Run: bf auth fizzy');
    process.exit(1);
  }

  const accountSlug = config.fizzy.default_account?.slug;
  if (!accountSlug) {
    logger.error('No default Fizzy account set');
    process.exit(1);
  }

  const spinner = logger.createSpinner('Fetching boards...');
  spinner.start();

  const client = new FizzyClient(config.fizzy);
  const boards = await client.getBoards(accountSlug);

  spinner.stop();

  if (boards.length === 0) {
    logger.warn('No boards found');
    return;
  }

  const choices = boards.map(b => ({
    name: `${b.name} (${b.id})`,
    value: b.id
  }));

  const { boardId } = await inquirer.prompt([
    {
      type: 'list',
      name: 'boardId',
      message: 'Select board:',
      choices,
      pageSize: 15
    }
  ]);

  await setBoardContext(boardId);
  logger.success(`✓ Using board: ${boardId}`);
}

/**
 * Set account context
 */
async function useAccount(config, accountSlug) {
  await setAccountContext(accountSlug);
  logger.success(`✓ Using account: ${accountSlug}`);
}
