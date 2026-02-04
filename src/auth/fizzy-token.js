import inquirer from 'inquirer';
import { FizzyClient } from '../clients/fizzy-client.js';
import { updateConfig } from '../config/config-manager.js';
import { AuthenticationError, ValidationError } from '../utils/errors.js';
import { isValidToken } from '../utils/validators.js';
import * as logger from '../utils/logger.js';
import Table from 'cli-table3';
import chalk from 'chalk';

/**
 * Main authentication flow for Fizzy personal access token
 * @returns {Promise<Object>} Authentication result with identity
 */
export async function authenticateFizzy() {
  logger.header('🔐 Fizzy Personal Access Token');
  logger.info('You need a personal access token from Fizzy.');
  logger.info('Get one from: https://app.fizzy.do/settings/tokens\n');

  // Prompt for token
  const { token } = await inquirer.prompt([
    {
      type: 'password',
      name: 'token',
      message: 'Enter your Fizzy personal access token:',
      mask: '*',
      validate: (input) => {
        if (!input || input.trim() === '') {
          return 'Token is required';
        }
        if (!isValidToken(input.trim())) {
          return 'Token format appears invalid';
        }
        return true;
      }
    }
  ]);

  const cleanToken = token.trim();

  logger.info('\nValidating token...');

  // Validate token by fetching identity
  const identity = await getFizzyIdentity(cleanToken);

  if (!identity || !identity.accounts || identity.accounts.length === 0) {
    throw new AuthenticationError('No Fizzy accounts found for this token');
  }

  logger.success('Token is valid!\n');

  // Display accounts
  displayAccounts(identity.accounts);

  // Prompt for default account selection
  const defaultAccount = await selectDefaultAccount(identity.accounts);

  // Store token and default account in config
  await updateConfig({
    fizzy: {
      access_token: cleanToken,
      default_account: defaultAccount
    }
  });

  logger.success('\nSuccessfully authenticated with Fizzy!');
  logger.info(`Default account: ${defaultAccount.name} (${defaultAccount.slug})\n`);

  return {
    token: cleanToken,
    default_account: defaultAccount,
    identity
  };
}

/**
 * Validate Fizzy token
 * @param {string} token - Personal access token
 * @returns {Promise<boolean>} True if valid
 */
export async function validateFizzyToken(token) {
  try {
    const identity = await getFizzyIdentity(token);
    return !!(identity && identity.accounts && identity.accounts.length > 0);
  } catch (error) {
    return false;
  }
}

/**
 * Get Fizzy identity information
 * @param {string} token - Personal access token
 * @returns {Promise<Object>} Identity object with accounts
 */
export async function getFizzyIdentity(token) {
  try {
    const client = new FizzyClient({ access_token: token });
    const identity = await client.getIdentity();
    return identity;
  } catch (error) {
    if (error.response?.status === 401) {
      throw new AuthenticationError('Invalid or expired token');
    }
    if (error.response?.status === 403) {
      throw new AuthenticationError('Token does not have sufficient permissions');
    }
    throw new AuthenticationError(`Failed to validate token: ${error.message}`);
  }
}

/**
 * Display accounts in a formatted table
 * @param {Array} accounts - Array of account objects
 */
function displayAccounts(accounts) {
  logger.info('Available accounts:\n');

  const table = new Table({
    head: [chalk.cyan('#'), chalk.cyan('Name'), chalk.cyan('Slug'), chalk.cyan('User Email')],
    style: {
      head: [],
      border: ['gray']
    }
  });

  accounts.forEach((account, index) => {
    table.push([
      (index + 1).toString(),
      account.name,
      account.slug,
      account.user?.email_address || 'N/A'
    ]);
  });

  console.log(table.toString());
  console.log('');
}

/**
 * Prompt user to select default account
 * @param {Array} accounts - Array of account objects
 * @returns {Promise<Object>} Selected account
 */
async function selectDefaultAccount(accounts) {
  if (accounts.length === 1) {
    logger.info('Only one account available, using as default.');
    return {
      id: accounts[0].id,
      name: accounts[0].name,
      slug: accounts[0].slug
    };
  }

  const choices = accounts.map((account, index) => ({
    name: `${account.name} (${account.slug})`,
    value: index
  }));

  const { accountIndex } = await inquirer.prompt([
    {
      type: 'list',
      name: 'accountIndex',
      message: 'Select default account:',
      choices
    }
  ]);

  const selected = accounts[accountIndex];
  return {
    id: selected.id,
    name: selected.name,
    slug: selected.slug
  };
}
