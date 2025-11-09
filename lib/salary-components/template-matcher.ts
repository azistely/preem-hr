/**
 * Template Similarity Detection Service
 *
 * Detects similar salary component templates based on:
 * - Name similarity (fuzzy matching with Levenshtein distance)
 * - Keyword extraction (ignoring French stop words)
 * - Category and type matching
 *
 * Reference: docs/COMPLIANCE-GUIDED-COMPONENT-CREATION.md
 */

import type { SalaryComponentTemplate } from '@/features/employees/types/salary-components';

export interface TemplateSuggestion {
  template: SalaryComponentTemplate;
  similarity: number; // 0-100
  matchReason: string;
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy name matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Template Matcher Class
 * Finds similar templates for custom component creation
 */
export class TemplateMatcher {
  // French stop words to ignore in keyword matching
  private readonly STOP_WORDS = [
    'de', 'du', 'la', 'le', 'les', 'un', 'une', 'des',
    'd', 'l', 'au', 'aux', 'et', 'ou', 'pour', 'dans'
  ];

  /**
   * Find similar templates based on name and category
   * @returns Top 3 suggestions sorted by similarity (threshold: 70%)
   */
  async findSimilarTemplates(
    input: {
      name: string;
      category: string;
    },
    templates: SalaryComponentTemplate[]
  ): Promise<TemplateSuggestion[]> {
    // Calculate similarity scores for all templates
    const scored = templates.map((template) => {
      let score = 0;
      const reasons: string[] = [];

      // Name similarity (70% weight)
      const nameSimilarity = this.calculateNameSimilarity(
        input.name,
        template.name.fr
      );
      score += nameSimilarity * 0.7;
      if (nameSimilarity > 70) {
        reasons.push(`Nom similaire (${Math.round(nameSimilarity)}%)`);
      }

      // Category match (30% weight)
      if (input.category === template.category) {
        score += 30;
        reasons.push('Même catégorie');
      }

      return {
        template,
        similarity: Math.round(score),
        matchReason: reasons.join(', ') || 'Aucune correspondance forte'
      };
    });

    // Return top 3 (threshold: 70%)
    return scored
      .filter((s) => s.similarity >= 70)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);
  }

  /**
   * Calculate name similarity using:
   * - Levenshtein distance (fuzzy matching)
   * - Keyword extraction (ignore articles, prepositions)
   *
   * @returns Similarity percentage (0-100)
   */
  private calculateNameSimilarity(input: string, template: string): number {
    // Normalize both strings
    const norm1 = this.normalizeName(input);
    const norm2 = this.normalizeName(template);

    // Exact match
    if (norm1 === norm2) return 100;

    // Fuzzy match using Levenshtein distance
    const distance = levenshteinDistance(norm1, norm2);
    const maxLength = Math.max(norm1.length, norm2.length);
    const fuzzyScore = ((maxLength - distance) / maxLength) * 100;

    // Keyword matching boost
    const keywords1 = this.extractKeywords(norm1);
    const keywords2 = this.extractKeywords(norm2);
    const keywordScore = this.calculateKeywordMatch(keywords1, keywords2);

    // Weighted average (70% fuzzy, 30% keywords)
    return fuzzyScore * 0.7 + keywordScore * 0.3;
  }

  /**
   * Normalize component name for comparison
   * - Lowercase
   * - Remove accents
   * - Remove special characters
   */
  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s]/g, '')     // Remove special chars
      .trim();
  }

  /**
   * Extract meaningful keywords from name
   * Filters out French stop words and short words
   */
  private extractKeywords(name: string): string[] {
    return name
      .split(/\s+/)
      .filter((word) =>
        !this.STOP_WORDS.includes(word) &&
        word.length > 2
      );
  }

  /**
   * Calculate keyword match percentage
   * @returns Percentage of matching keywords (0-100)
   */
  private calculateKeywordMatch(keywords1: string[], keywords2: string[]): number {
    if (keywords1.length === 0 || keywords2.length === 0) {
      return 0;
    }

    const commonKeywords = keywords1.filter((k) => keywords2.includes(k));
    const totalUniqueKeywords = new Set([...keywords1, ...keywords2]).size;

    return (commonKeywords.length / totalUniqueKeywords) * 100;
  }

  /**
   * Detect if name suggests a reimbursement
   * Uses same logic as database function detect_reimbursement_from_name()
   */
  detectReimbursement(componentName: string): boolean {
    const normalized = this.normalizeName(componentName);
    const keywords = [
      'remboursement',
      'frais',
      'indemnisation',
      'indemnite de deplacement',
      'indemnite de salissure',
      'indemnite kilometrique',
      'per diem'
    ];

    return keywords.some((kw) => normalized.includes(kw));
  }
}

// Export singleton instance
export const templateMatcher = new TemplateMatcher();

// Export for testing
export { levenshteinDistance };
