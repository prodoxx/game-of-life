/**
 * sanitizes user input to prevent xss and other injection attacks
 */

// max length for player names
export const MAX_PLAYER_NAME_LENGTH = 20;

/**
 * sanitizes a player name by:
 * 1. trimming whitespace
 * 2. removing html tags
 * 3. removing special characters
 * 4. limiting length
 * 5. ensuring non-empty result
 */
export const sanitizePlayerName = (name: string): string => {
  if (!name) return "";

  return name
    .trim() // remove leading/trailing whitespace
    .replace(/<[^>]*>/g, "") // remove html tags
    .replace(/[^\w\s-]/g, "") // remove special chars except hyphen
    .slice(0, MAX_PLAYER_NAME_LENGTH) // limit length
    .trim(); // trim again in case we're left with spaces
};

/**
 * validates if a sanitized player name is valid
 */
export const isValidPlayerName = (name: string): boolean => {
  const sanitized = sanitizePlayerName(name);
  return sanitized.length > 0 && sanitized.length <= MAX_PLAYER_NAME_LENGTH;
};
