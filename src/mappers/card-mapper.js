/**
 * Card Mapper
 * Transforms Basecamp cards to Fizzy card format
 */

import { convertBasecampToFizzyHTML } from './html-converter.js';

// Fizzy card title limits (conservative to avoid 500 errors)
const MAX_TITLE_LENGTH = 255;

/**
 * Map a Basecamp card to Fizzy card format
 * @param {Object} basecampCard - Basecamp card object
 * @param {Object} context - Mapping context
 * @param {Object} context.userMappings - User ID mappings (basecamp_id -> fizzy_id)
 * @param {Object} context.columnMappings - Column mappings (basecamp_column_id -> action)
 * @param {string} context.currentUserFizzyId - Current authenticated Fizzy user ID
 * @returns {Object} Mapped card data with metadata
 */
export function mapCard(basecampCard, context) {
  const { userMappings = {}, columnMappings = {}, currentUserFizzyId } = context;

  // Extract description (Basecamp uses 'content' field)
  let description = basecampCard.content 
    ? convertBasecampToFizzyHTML(basecampCard.content)
    : '';

  // Map assignees (filter out unmapped users)
  const assignees = mapAssignees(basecampCard.assignees || [], userMappings);

  // Map steps/checklist items
  const steps = mapSteps(basecampCard.steps || [], userMappings);

  // Determine column action
  const columnAction = columnMappings[basecampCard.parent?.id] || null;

  // Handle long titles by moving overflow to description
  let title = basecampCard.title;
  if (title && title.length > MAX_TITLE_LENGTH) {
    const truncatedPart = title.substring(MAX_TITLE_LENGTH);
    title = title.substring(0, MAX_TITLE_LENGTH);
    
    // Prepend truncated part to description
    if (description) {
      description = `${truncatedPart}\n\n---\n\n${description}`;
    } else {
      description = truncatedPart;
    }
  }

  // Add Basecamp ID marker to description (for duplicate detection)
  // Format: #basecamp-id-{id}
  const basecampMarker = `#basecamp-id-${basecampCard.id}`;
  if (description) {
    description = `${description}\n\n${basecampMarker}`;
  } else {
    description = basecampMarker;
  }

  // Build Fizzy card object
  const fizzyCard = {
    title: title,
    description: description,
    status: 'published'
  };

  // Return card with metadata for migration process
  return {
    card: fizzyCard,
    metadata: {
      basecamp_id: basecampCard.id,
      basecamp_url: basecampCard.app_url,
      basecamp_parent_id: basecampCard.parent?.id,
      basecamp_parent_title: basecampCard.parent?.title,
      column_action: columnAction,
      assignee_ids: assignees.mapped,
      unmapped_assignees: assignees.unmapped,
      steps: steps.mapped,
      unmapped_step_assignees: steps.unmappedAssignees,
      completed: basecampCard.completed || false,
      created_at: basecampCard.created_at,
      updated_at: basecampCard.updated_at,
      comments_count: basecampCard.comments_count || 0
    }
  };
}

/**
 * Map Basecamp assignees to Fizzy user IDs
 * @param {Array} basecampAssignees - Array of Basecamp assignee objects
 * @param {Object} userMappings - User ID mappings
 * @returns {Object} Object with mapped and unmapped assignees
 */
export function mapAssignees(basecampAssignees, userMappings) {
  const mapped = [];
  const unmapped = [];

  for (const assignee of basecampAssignees) {
    const basecampId = assignee.id.toString();
    const mapping = userMappings[basecampId];

    if (mapping && mapping.fizzy_id) {
      mapped.push(mapping.fizzy_id);
    } else {
      unmapped.push({
        id: assignee.id,
        name: assignee.name,
        email: assignee.email_address
      });
    }
  }

  return { mapped, unmapped };
}

/**
 * Map Basecamp steps/checklist items to Fizzy steps
 * @param {Array} basecampSteps - Array of Basecamp step objects
 * @param {Object} userMappings - User ID mappings
 * @returns {Object} Object with mapped steps and unmapped assignees
 */
export function mapSteps(basecampSteps, userMappings) {
  const mapped = [];
  const unmappedAssignees = [];

  for (const step of basecampSteps) {
    const fizzyStep = {
      title: step.content || step.title,
      completed: step.completed || false
    };

    // Note: Fizzy steps don't support assignees
    // If Basecamp step has an assignee, track it as unmapped
    if (step.assignee) {
      const basecampId = step.assignee.id.toString();
      const mapping = userMappings[basecampId];

      if (!mapping || !mapping.fizzy_id) {
        unmappedAssignees.push({
          step_title: fizzyStep.title,
          assignee_id: step.assignee.id,
          assignee_name: step.assignee.name,
          assignee_email: step.assignee.email_address
        });
      } else {
        // Track that this step had a mapped assignee (for reporting)
        fizzyStep.had_assignee = mapping.fizzy_name;
      }
    }

    mapped.push(fizzyStep);
  }

  return { mapped, unmappedAssignees };
}

/**
 * Map Basecamp comment to Fizzy comment format
 * @param {Object} basecampComment - Basecamp comment object
 * @param {Object} userMappings - User ID mappings
 * @param {string} currentUserFizzyId - Current authenticated Fizzy user ID
 * @returns {Object} Mapped comment with attribution info
 */
export function mapComment(basecampComment, userMappings, currentUserFizzyId) {
  const creatorId = basecampComment.creator?.id?.toString();
  const mapping = userMappings[creatorId];

  let body = basecampComment.content 
    ? convertBasecampToFizzyHTML(basecampComment.content)
    : '';

  const result = {
    body: body,
    author_fizzy_id: null,
    needs_attribution: false,
    original_author: null
  };

  if (mapping && mapping.fizzy_id) {
    // Comment will be posted under the mapped user
    result.author_fizzy_id = mapping.fizzy_id;
  } else if (basecampComment.creator) {
    // Need to add attribution since we can't post as original author
    result.needs_attribution = true;
    result.original_author = {
      name: basecampComment.creator.name,
      email: basecampComment.creator.email_address,
      created_at: basecampComment.created_at
    };

    // Prepend attribution to comment body
    const date = new Date(basecampComment.created_at).toLocaleDateString();
    result.body = `_Original comment by ${basecampComment.creator.name} on ${date}_\n\n${body}`;
  }

  return result;
}

/**
 * Extract Basecamp ID from card description
 * @param {string} description - Card description
 * @returns {string|null} Basecamp ID or null if not found
 */
export function extractBasecampId(description) {
  if (!description) return null;
  
  // Match format: #basecamp-id-{id}
  const match = description.match(/#basecamp-id-(\d+)/);
  return match ? match[1] : null;
}
