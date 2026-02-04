import chalk from 'chalk';
import { loadConfig, isBasecampAuthenticated, isFizzyAuthenticated } from '../config/config-manager.js';
import { authenticateBasecamp } from '../auth/basecamp-oauth.js';
import { authenticateFizzy } from '../auth/fizzy-token.js';
import * as logger from '../utils/logger.js';
import Table from 'cli-table3';

/**
 * Handle auth command
 * @param {string} service - 'basecamp', 'fizzy', or undefined for status
 */
export async function authCommand(service) {
  try {
    if (!service) {
      // No service specified, show status
      await showAuthStatus();
      return;
    }

    const normalizedService = service.toLowerCase();

    switch (normalizedService) {
      case 'basecamp':
        await authenticateBasecampCommand();
        break;
      case 'fizzy':
        await authenticateFizzyCommand();
        break;
      case 'status':
        await showAuthStatus();
        break;
      default:
        logger.error(`Unknown service: ${service}`);
        logger.info('Valid services: basecamp, fizzy, status');
        process.exit(1);
    }
  } catch (error) {
    logger.error('Authentication failed', error);
    process.exit(1);
  }
}

/**
 * Authenticate with Basecamp
 */
async function authenticateBasecampCommand() {
  try {
    const result = await authenticateBasecamp();
    logger.success('✓ Basecamp authentication complete!');
  } catch (error) {
    throw error;
  }
}

/**
 * Authenticate with Fizzy
 */
async function authenticateFizzyCommand() {
  try {
    const result = await authenticateFizzy();
    logger.success('✓ Fizzy authentication complete!');
  } catch (error) {
    throw error;
  }
}

/**
 * Show authentication status for both services
 */
async function showAuthStatus() {
  logger.header('🔐 Authentication Status');

  const config = await loadConfig();
  
  const table = new Table({
    head: [chalk.cyan('Service'), chalk.cyan('Status'), chalk.cyan('Details')],
    colWidths: [15, 20, 60],
    style: {
      head: [],
      border: ['gray']
    },
    wordWrap: true
  });

  // Basecamp status
  if (isBasecampAuthenticated(config)) {
    const expiresAt = new Date(config.basecamp.token_expires_at * 1000);
    const isExpired = expiresAt < new Date();
    
    table.push([
      'Basecamp',
      isExpired ? chalk.yellow('⚠️  Expired') : chalk.green('✓ Authenticated'),
      [
        `Account ID: ${config.basecamp.account_id}`,
        `Expires: ${expiresAt.toLocaleString()}`,
        isExpired ? chalk.yellow('Run: bf auth basecamp') : ''
      ].filter(Boolean).join('\n')
    ]);
  } else {
    table.push([
      'Basecamp',
      chalk.red('✗ Not authenticated'),
      chalk.gray('Run: bf auth basecamp')
    ]);
  }

  // Fizzy status
  if (isFizzyAuthenticated(config)) {
    table.push([
      'Fizzy',
      chalk.green('✓ Authenticated'),
      [
        `Default Account: ${config.fizzy.default_account?.name || 'N/A'}`,
        `Slug: ${config.fizzy.default_account?.slug || 'N/A'}`
      ].join('\n')
    ]);
  } else {
    table.push([
      'Fizzy',
      chalk.red('✗ Not authenticated'),
      chalk.gray('Run: bf auth fizzy')
    ]);
  }

  console.log(table.toString());
  console.log('');

  // Show next steps if not fully authenticated
  if (!isBasecampAuthenticated(config) || !isFizzyAuthenticated(config)) {
    logger.info(chalk.bold('Next steps:'));
    if (!isBasecampAuthenticated(config)) {
      logger.info(`  ${chalk.cyan('bf auth basecamp')} - Authenticate with Basecamp`);
    }
    if (!isFizzyAuthenticated(config)) {
      logger.info(`  ${chalk.cyan('bf auth fizzy')}    - Authenticate with Fizzy`);
    }
    console.log('');
  } else {
    logger.success('All services authenticated! You can now migrate card tables.');
    logger.info(`Run ${chalk.cyan('bf list projects')} to see your Basecamp projects.\n`);
  }
}
