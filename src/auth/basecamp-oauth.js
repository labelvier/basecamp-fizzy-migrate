import express from 'express';
import open from 'open';
import axios from 'axios';
import chalk from 'chalk';
import { updateConfig } from '../config/config-manager.js';
import { BASECAMP_DEFAULTS } from '../config/defaults.js';
import { AuthenticationError } from '../utils/errors.js';
import * as logger from '../utils/logger.js';

const CALLBACK_TIMEOUT = 300000; // 5 minutes

/**
 * Main authentication flow for Basecamp OAuth
 * @returns {Promise<Object>} Authentication result with tokens
 */
export async function authenticateBasecamp() {
  logger.header('🔐 Basecamp OAuth Authentication');
  logger.info('Starting OAuth flow...\n');

  const app = express();
  let server;
  let authorizationCode;
  let resolveAuth;
  let rejectAuth;

  const authPromise = new Promise((resolve, reject) => {
    resolveAuth = resolve;
    rejectAuth = reject;
  });

  // Setup callback route
  app.get('/auth/callback', (req, res) => {
    const { code, error, error_description } = req.query;

    if (error) {
      res.send(`
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1 style="color: #e74c3c;">❌ Authentication Failed</h1>
            <p style="color: #7f8c8d;">${error_description || error}</p>
            <p style="margin-top: 20px;">You can close this window.</p>
          </body>
        </html>
      `);
      rejectAuth(new AuthenticationError(`OAuth error: ${error_description || error}`));
      return;
    }

    if (!code) {
      res.send(`
        <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1 style="color: #e74c3c;">❌ No Authorization Code</h1>
            <p style="color: #7f8c8d;">No authorization code was received.</p>
            <p style="margin-top: 20px;">You can close this window.</p>
          </body>
        </html>
      `);
      rejectAuth(new AuthenticationError('No authorization code received'));
      return;
    }

    authorizationCode = code;
    res.send(`
      <html>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1 style="color: #27ae60;">✅ Authorization Successful!</h1>
          <p style="color: #7f8c8d;">You can close this window and return to the terminal.</p>
        </body>
      </html>
    `);
    resolveAuth(code);
  });

  // Start server
  await new Promise((resolve) => {
    server = app.listen(8000, () => {
      logger.success('Callback server started on http://localhost:8000\n');
      resolve();
    });
  });

  try {
    // Generate and open authorization URL
    const authUrl = getAuthorizationUrl();
    logger.info('Opening browser for authorization...');
    logger.info(`If browser doesn't open, visit: ${chalk.cyan(authUrl)}\n`);
    
    await open(authUrl);

    // Wait for callback with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new AuthenticationError('Authentication timeout after 5 minutes'));
      }, CALLBACK_TIMEOUT);
    });

    await Promise.race([authPromise, timeoutPromise]);

    if (!authorizationCode) {
      throw new AuthenticationError('No authorization code received');
    }

    logger.info('Authorization code received, exchanging for access token...\n');

    // Exchange code for tokens
    const tokens = await exchangeCodeForToken(authorizationCode);

    // Get authorization info (includes expires_at and account info)
    const authInfo = await getAuthorizationInfo(tokens.access_token);
    
    // Get all BC3 accounts
    const bc3Accounts = authInfo.accounts.filter(acc => acc.product === 'bc3');
    if (bc3Accounts.length === 0) {
      throw new AuthenticationError('No Basecamp 3 account found. This tool only works with Basecamp 3.');
    }
    
    // Let user select account if multiple
    let selectedAccount;
    if (bc3Accounts.length === 1) {
      selectedAccount = bc3Accounts[0];
      logger.info(`Using account: ${selectedAccount.name}\n`);
    } else {
      logger.info(`Found ${bc3Accounts.length} Basecamp 3 accounts:\n`);
      
      const inquirer = (await import('inquirer')).default;
      const choices = bc3Accounts.map((acc, index) => ({
        name: `${acc.name} (ID: ${acc.id})`,
        value: index
      }));
      
      const { accountIndex } = await inquirer.prompt([
        {
          type: 'list',
          name: 'accountIndex',
          message: 'Select Basecamp account:',
          choices
        }
      ]);
      
      selectedAccount = bc3Accounts[accountIndex];
    }
    
    const accountId = selectedAccount.id.toString();

    // Parse expires_at timestamp
    const expiresAt = authInfo.expires_at ? Math.floor(new Date(authInfo.expires_at).getTime() / 1000) : null;

    // Store tokens in config
    await updateConfig({
      basecamp: {
        account_id: accountId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt
      }
    });

    logger.success(`Successfully authenticated!`);
    logger.info(`Account: ${selectedAccount.name}`);
    logger.info(`Account ID: ${accountId}`);
    
    // Format expiry date properly
    if (expiresAt) {
      const expiryDate = new Date(expiresAt * 1000);
      logger.info(`Token expires: ${expiryDate.toLocaleString()}\n`);
    } else {
      logger.info(`Token expires: ${authInfo.expires_at}\n`);
    }

    return {
      account_id: accountId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt
    };

  } catch (error) {
    throw error;
  } finally {
    // Clean up server
    if (server) {
      server.close();
      logger.debug('Callback server stopped', true);
    }
  }
}

/**
 * Generate Basecamp OAuth authorization URL
 * @returns {string} Authorization URL
 */
export function getAuthorizationUrl() {
  const params = new URLSearchParams({
    type: 'web_server',
    client_id: BASECAMP_DEFAULTS.OAUTH.CLIENT_ID,
    redirect_uri: BASECAMP_DEFAULTS.OAUTH.REDIRECT_URI
  });

  return `${BASECAMP_DEFAULTS.OAUTH.AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 * @param {string} code - Authorization code from callback
 * @returns {Promise<Object>} Token response
 */
export async function exchangeCodeForToken(code) {
  try {
    const response = await axios.post(
      BASECAMP_DEFAULTS.OAUTH.TOKEN_URL,
      {
        type: 'web_server',
        client_id: BASECAMP_DEFAULTS.OAUTH.CLIENT_ID,
        client_secret: BASECAMP_DEFAULTS.OAUTH.CLIENT_SECRET,
        redirect_uri: BASECAMP_DEFAULTS.OAUTH.REDIRECT_URI,
        code: code
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'bc-fizzy-migrate/1.0.0 (https://github.com/yourusername/bc-fizzy-migrate)'
        }
      }
    );

    // Basecamp token response only contains access_token and refresh_token
    // expires_at comes from the /authorization.json endpoint
    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token
    };
  } catch (error) {
    if (error.response) {
      throw new AuthenticationError(
        `Token exchange failed: ${error.response.data.error || error.response.statusText}`
      );
    }
    throw new AuthenticationError(`Token exchange failed: ${error.message}`);
  }
}

/**
 * Get authorization info including expires_at and accounts
 * @param {string} accessToken - Access token
 * @returns {Promise<Object>} Authorization info with identity and accounts
 */
async function getAuthorizationInfo(accessToken) {
  try {
    const response = await axios.get(
      'https://launchpad.37signals.com/authorization.json',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'bc-fizzy-migrate/1.0.0 (https://github.com/yourusername/bc-fizzy-migrate)'
        }
      }
    );

    return response.data;
  } catch (error) {
    if (error.response) {
      throw new AuthenticationError(
        `Failed to get authorization info: ${error.response.statusText}`
      );
    }
    throw new AuthenticationError(`Failed to get authorization info: ${error.message}`);
  }
}
