import axios from 'axios';
import { RateLimiter, withRetry } from './rate-limiter.js';
import { defaults } from '../config/defaults.js';
import { ApiError } from '../utils/errors.js';
import { parseLinkHeader } from '../utils/validators.js';

/**
 * Fizzy API Client
 */
export class FizzyClient {
  constructor(config) {
    this.config = config;
    this.accessToken = config.access_token;
    this.defaultAccount = config.default_account;
    this.baseUrl = defaults.fizzy.apiUrl;
    
    // Rate limiter
    this.rateLimiter = new RateLimiter(defaults.fizzy.rateLimit);
    
    // Create axios instance
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    // Request interceptor for auth and rate limiting
    this.client.interceptors.request.use(async (config) => {
      // Rate limiting
      await this.rateLimiter.throttle();
      
      // Add authorization header
      config.headers.Authorization = `Bearer ${this.accessToken}`;
      
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        throw new ApiError(
          error.message,
          error.response?.status,
          error.response?.data
        );
      }
    );
  }

  /**
   * Make a GET request with retry logic
   */
  async get(path, options = {}) {
    return withRetry(() => this.client.get(path, options));
  }

  /**
   * Make a POST request with retry logic
   */
  async post(path, data) {
    return withRetry(() => this.client.post(path, data));
  }

  /**
   * Make a PUT request with retry logic
   */
  async put(path, data) {
    return withRetry(() => this.client.put(path, data));
  }

  /**
   * Make a DELETE request with retry logic
   */
  async delete(path) {
    return withRetry(() => this.client.delete(path));
  }

  /**
   * Get identity (accounts list)
   */
  async getIdentity() {
    const response = await this.get('/my/identity');
    return response.data;
  }

  /**
   * Get boards for an account
   */
  async getBoards(accountSlug) {
    const response = await this.get(`${accountSlug}/boards`);
    return response.data;
  }

  /**
   * Get a single board
   */
  async getBoard(accountSlug, boardId) {
    const response = await this.get(`${accountSlug}/boards/${boardId}`);
    return response.data;
  }

  /**
   * Create a new board
   */
  async createBoard(accountSlug, data) {
    const response = await this.post(`${accountSlug}/boards`, { board: data });
    
    // Fizzy returns 201 with Location header but no body
    // Extract board ID from Location header and fetch the board
    const location = response.headers?.location;
    if (location) {
      // Location format: /account/boards/ID.json
      const match = location.match(/\/boards\/([^.]+)/);
      if (match) {
        const boardId = match[1];
        return await this.getBoard(accountSlug, boardId);
      }
    }
    
    // Fallback: return empty object if Location header is missing
    return response.data || {};
  }

  /**
   * Get columns for a board
   */
  async getColumns(accountSlug, boardId) {
    const response = await this.get(`${accountSlug}/boards/${boardId}/columns`);
    return response.data;
  }

  /**
   * Create a new column
   */
  async createColumn(accountSlug, boardId, data) {
    const response = await this.post(`${accountSlug}/boards/${boardId}/columns`, { column: data });
    
    // Similar to createBoard, Fizzy might return Location header
    const location = response.headers?.location;
    if (location && !response.data) {
      // Extract column ID and fetch if needed
      const match = location.match(/\/columns\/([^.]+)/);
      if (match) {
        const columnId = match[1];
        // Fetch all columns and find the one we just created
        const columns = await this.getColumns(accountSlug, boardId);
        return columns.find(c => c.id === columnId) || response.data || {};
      }
    }
    
    return response.data || {};
  }

  /**
   * Get cards with optional filters
   */
  async getCards(accountSlug, filters = {}) {
    const params = new URLSearchParams();
    
    if (filters.board_ids) {
      filters.board_ids.forEach(id => params.append('board_ids[]', id));
    }
    if (filters.tag_ids) {
      filters.tag_ids.forEach(id => params.append('tag_ids[]', id));
    }
    if (filters.page) {
      params.append('page', filters.page);
    }
    
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await this.get(`${accountSlug}/cards${query}`);
    
    return {
      data: response.data,
      hasMore: !!response.headers.link && response.headers.link.includes('rel="next"')
    };
  }

  /**
   * Paginate through cards
   */
  async *paginateCards(accountSlug, filters = {}) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await this.getCards(accountSlug, { ...filters, page });
      
      yield result.data;
      
      hasMore = result.hasMore;
      page++;
    }
  }

  /**
   * Get a single card
   */
  async getCard(accountSlug, cardNumber) {
    const response = await this.get(`${accountSlug}/cards/${cardNumber}`);
    return response.data;
  }

  /**
   * Create a new card
   */
  async createCard(accountSlug, boardId, data) {
    const response = await this.post(`${accountSlug}/boards/${boardId}/cards`, { card: data });
    
    // Extract card number from Location header
    const location = response.headers.location;
    if (location) {
      const match = location.match(/\/cards\/(\d+)/);
      if (match) {
        return await this.getCard(accountSlug, match[1]);
      }
    }
    
    return response.data;
  }

  /**
   * Update a card
   */
  async updateCard(accountSlug, cardNumber, data) {
    const response = await this.put(`${accountSlug}/cards/${cardNumber}`, { card: data });
    return response.data;
  }

  /**
   * Move a card from triage to a column
   */
  async triageCard(accountSlug, cardNumber, columnId) {
    await this.post(`${accountSlug}/cards/${cardNumber}/triage`, { column_id: columnId });
  }

  /**
   * Close a card
   */
  async closeCard(accountSlug, cardNumber) {
    await this.post(`${accountSlug}/cards/${cardNumber}/closure`, {});
  }

  /**
   * Move a card to "Not Now"
   */
  async notNowCard(accountSlug, cardNumber) {
    await this.post(`${accountSlug}/cards/${cardNumber}/not_now`, {});
  }

  /**
   * Create a step on a card
   */
  async createStep(accountSlug, cardNumber, data) {
    const response = await this.post(`${accountSlug}/cards/${cardNumber}/steps`, { step: data });
    return response.data;
  }

  /**
   * Update a step
   */
  async updateStep(accountSlug, cardNumber, stepId, data) {
    const response = await this.put(`${accountSlug}/cards/${cardNumber}/steps/${stepId}`, { step: data });
    return response.data;
  }

  /**
   * Create a comment on a card
   */
  async createComment(accountSlug, cardNumber, data) {
    const response = await this.post(`${accountSlug}/cards/${cardNumber}/comments`, { comment: data });
    return response.data;
  }

  /**
   * Get all tags in an account
   */
  async getTags(accountSlug) {
    const response = await this.get(`${accountSlug}/tags`);
    return response.data;
  }

  /**
   * Add a tag to a card
   */
  async addTag(accountSlug, cardNumber, tagTitle) {
    await this.post(`${accountSlug}/cards/${cardNumber}/taggings`, { tag_title: tagTitle });
  }

  /**
   * Get users in an account
   */
  async getUsers(accountSlug) {
    const response = await this.get(`${accountSlug}/users`);
    return response.data;
  }

  /**
   * Assign a user to a card
   */
  async assignUser(accountSlug, cardNumber, assigneeId) {
    await this.post(`${accountSlug}/cards/${cardNumber}/assignments`, { assignee_id: assigneeId });
  }
}
