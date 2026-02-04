import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export const BASECAMP_DEFAULTS = {
  API_URL: process.env.BASECAMP_API_URL || 'https://3.basecampapi.com',
  OAUTH: {
    CLIENT_ID: process.env.BASECAMP_CLIENT_ID,
    CLIENT_SECRET: process.env.BASECAMP_CLIENT_SECRET,
    REDIRECT_URI: process.env.BASECAMP_REDIRECT_URI || 'http://localhost:8000/auth/callback',
    AUTHORIZE_URL: 'https://launchpad.37signals.com/authorization/new',
    TOKEN_URL: 'https://launchpad.37signals.com/authorization/token'
  },
  RATE_LIMIT: parseInt(process.env.BASECAMP_RATE_LIMIT || '5', 10),
  USER_AGENT: 'bc-fizzy-migrate/1.0.0'
};

export const FIZZY_DEFAULTS = {
  API_URL: process.env.FIZZY_API_URL || 'https://app.fizzy.do',
  RATE_LIMIT: parseInt(process.env.FIZZY_RATE_LIMIT || '5', 10)
};

export const MIGRATION_DEFAULTS = {
  BATCH_SIZE: 10,
  MAX_RETRIES: 3,
  BASE_DELAY_MS: 1000
};

// Keep the old export for backwards compatibility
export const defaults = {
  basecamp: {
    apiUrl: BASECAMP_DEFAULTS.API_URL,
    clientId: BASECAMP_DEFAULTS.OAUTH.CLIENT_ID,
    clientSecret: BASECAMP_DEFAULTS.OAUTH.CLIENT_SECRET,
    redirectUri: BASECAMP_DEFAULTS.OAUTH.REDIRECT_URI,
    authUrl: BASECAMP_DEFAULTS.OAUTH.AUTHORIZE_URL,
    tokenUrl: BASECAMP_DEFAULTS.OAUTH.TOKEN_URL,
    rateLimit: BASECAMP_DEFAULTS.RATE_LIMIT
  },
  fizzy: {
    apiUrl: FIZZY_DEFAULTS.API_URL,
    rateLimit: FIZZY_DEFAULTS.RATE_LIMIT
  },
  migration: {
    batchSize: MIGRATION_DEFAULTS.BATCH_SIZE,
    maxRetries: MIGRATION_DEFAULTS.MAX_RETRIES,
    baseDelayMs: MIGRATION_DEFAULTS.BASE_DELAY_MS
  }
};
