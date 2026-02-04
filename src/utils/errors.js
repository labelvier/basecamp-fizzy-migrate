/**
 * Custom error classes for better error handling
 */

export class MigrationError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'MigrationError';
    this.cause = cause;
  }
}

export class AuthenticationError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'AuthenticationError';
    this.cause = cause;
  }
}

export class ApiError extends Error {
  constructor(message, statusCode, response) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.response = response;
  }
}

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}
