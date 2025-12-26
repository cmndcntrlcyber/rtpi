/**
 * Simple fuzzy search implementation
 * Scores items based on how well they match the search query
 */

export interface FuzzySearchResult<T> {
  item: T;
  score: number;
  matches: { field: string; indices: number[] }[];
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1].toLowerCase() === str2[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate fuzzy match score (0-1, higher is better)
 */
function calculateScore(query: string, text: string): number {
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();

  // Exact match
  if (textLower === queryLower) return 1.0;

  // Starts with query
  if (textLower.startsWith(queryLower)) return 0.9;

  // Contains query
  if (textLower.includes(queryLower)) return 0.8;

  // Fuzzy match using Levenshtein distance
  const distance = levenshteinDistance(queryLower, textLower);
  const maxLength = Math.max(queryLower.length, textLower.length);
  const similarity = 1 - distance / maxLength;

  // Only return scores above threshold
  return similarity > 0.6 ? similarity * 0.7 : 0;
}

/**
 * Find match indices in text
 */
function findMatchIndices(query: string, text: string): number[] {
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  const indices: number[] = [];

  let searchPos = 0;
  for (const char of queryLower) {
    const index = textLower.indexOf(char, searchPos);
    if (index !== -1) {
      indices.push(index);
      searchPos = index + 1;
    }
  }

  return indices;
}

/**
 * Perform fuzzy search on an array of items
 *
 * @param items - Array of items to search
 * @param query - Search query string
 * @param keys - Object keys to search (for objects)
 * @param threshold - Minimum score threshold (0-1)
 * @returns Sorted array of search results
 */
export function fuzzySearch<T>(
  items: T[],
  query: string,
  keys: (keyof T)[] = [],
  threshold: number = 0.3
): FuzzySearchResult<T>[] {
  if (!query.trim()) return [];

  const results: FuzzySearchResult<T>[] = [];

  for (const item of items) {
    let maxScore = 0;
    const matches: { field: string; indices: number[] }[] = [];

    // If item is a string, search directly
    if (typeof item === "string") {
      const score = calculateScore(query, item);
      if (score > threshold) {
        maxScore = score;
        matches.push({
          field: "value",
          indices: findMatchIndices(query, item),
        });
      }
    } else {
      // Search in specified keys
      for (const key of keys) {
        const value = item[key];
        if (value && typeof value === "string") {
          const score = calculateScore(query, value);
          if (score > maxScore) {
            maxScore = score;
          }
          if (score > threshold) {
            matches.push({
              field: String(key),
              indices: findMatchIndices(query, value),
            });
          }
        }
      }
    }

    if (maxScore > threshold) {
      results.push({ item, score: maxScore, matches });
    }
  }

  // Sort by score (highest first)
  return results.sort((a, b) => b.score - a.score);
}

export interface HighlightedTextPart {
  text: string;
  highlighted: boolean;
}

/**
 * Prepare text for highlighting by identifying matched character indices
 * Returns an array of text parts with highlighting information
 */
export function highlightMatches(text: string, indices: number[]): HighlightedTextPart[] {
  if (!indices.length) return [{ text, highlighted: false }];

  const parts: HighlightedTextPart[] = [];
  let lastIndex = 0;

  const sortedIndices = [...new Set(indices)].sort((a, b) => a - b);

  for (const index of sortedIndices) {
    if (index >= text.length) continue;

    // Add text before match
    if (index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, index), highlighted: false });
    }

    // Add highlighted character
    parts.push({ text: text[index], highlighted: true });

    lastIndex = index + 1;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlighted: false });
  }

  return parts;
}
