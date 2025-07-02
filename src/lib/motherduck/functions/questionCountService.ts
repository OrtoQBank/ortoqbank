/**
 * MotherDuck service for efficient question counting
 * Handles all count queries through DuckDB for optimal performance
 */

import type { MaterializedQueryResult } from '@motherduck/wasm-client';

export interface QuestionCounts {
  // Question mode counts (global)
  totalQuestions: number;

  // Counts by taxonomy
  themesCounts: Record<
    string,
    {
      all: number;
      unanswered: number;
      incorrect: number;
      bookmarked: number;
    }
  >;

  subthemesCounts: Record<
    string,
    {
      all: number;
      unanswered: number;
      incorrect: number;
      bookmarked: number;
    }
  >;

  groupsCounts: Record<
    string,
    {
      all: number;
      unanswered: number;
      incorrect: number;
      bookmarked: number;
    }
  >;
}

export interface CountQueryParams {
  userId: string;
  questionMode: 'all' | 'unanswered' | 'incorrect' | 'bookmarked';
  selectedThemes?: string[];
  selectedSubthemes?: string[];
  selectedGroups?: string[];
}

export class QuestionCountService {
  constructor(
    private evaluateQuery: (query: string) => Promise<MaterializedQueryResult>,
  ) {}

  /**
   * Fetch all question counts efficiently in a single query
   * This will be the main method to get baseline counts for all taxonomies
   */
  async fetchAllBaseCounts(userId: string): Promise<QuestionCounts> {
    const query = `
      WITH base_questions AS (
        SELECT 
          q._id as question_id,
          q.TaxThemeId as theme_id,
          q.TaxSubthemeId as subtheme_id, 
          q.TaxGroupId as group_id
        FROM questions q
      ),
      user_stats AS (
        SELECT 
          uqs.questionId as question_id,
          CASE WHEN uqs.userId = '${userId}' THEN 1 ELSE 0 END as is_answered,
          CASE WHEN uqs.userId = '${userId}' AND uqs.isCorrect = false THEN 1 ELSE 0 END as is_incorrect
        FROM userQuestionStats uqs
        WHERE uqs.userId = '${userId}'
      ),
      user_bookmarks AS (
        SELECT 
          ub.questionId as question_id,
          CASE WHEN ub.userId = '${userId}' THEN 1 ELSE 0 END as is_bookmarked
        FROM userBookmarks ub  
        WHERE ub.userId = '${userId}'
      ),
      enriched_questions AS (
        SELECT 
          bq.*,
          COALESCE(us.is_answered, 0) as is_answered,
          COALESCE(us.is_incorrect, 0) as is_incorrect,
          COALESCE(ub.is_bookmarked, 0) as is_bookmarked
        FROM base_questions bq
        LEFT JOIN user_stats us ON bq.question_id = us.question_id
        LEFT JOIN user_bookmarks ub ON bq.question_id = ub.question_id
      )
      
      -- Get counts by theme
      SELECT 
        'theme' as type,
        theme_id as taxonomy_id,
        COUNT(*) as all_count,
        COUNT(*) - SUM(is_answered) as unanswered_count,
        SUM(is_incorrect) as incorrect_count,
        SUM(is_bookmarked) as bookmarked_count
      FROM enriched_questions 
      WHERE theme_id IS NOT NULL
      GROUP BY theme_id
      
      UNION ALL
      
      -- Get counts by subtheme  
      SELECT 
        'subtheme' as type,
        subtheme_id as taxonomy_id,
        COUNT(*) as all_count,
        COUNT(*) - SUM(is_answered) as unanswered_count,
        SUM(is_incorrect) as incorrect_count,
        SUM(is_bookmarked) as bookmarked_count
      FROM enriched_questions 
      WHERE subtheme_id IS NOT NULL
      GROUP BY subtheme_id
      
      UNION ALL
      
      -- Get counts by group
      SELECT 
        'group' as type,
        group_id as taxonomy_id,
        COUNT(*) as all_count,
        COUNT(*) - SUM(is_answered) as unanswered_count,
        SUM(is_incorrect) as incorrect_count,
        SUM(is_bookmarked) as bookmarked_count
      FROM enriched_questions 
      WHERE group_id IS NOT NULL  
      GROUP BY group_id
      
      UNION ALL
      
      -- Get total count
      SELECT 
        'total' as type,
        'all' as taxonomy_id,
        COUNT(*) as all_count,
        COUNT(*) - SUM(is_answered) as unanswered_count,
        SUM(is_incorrect) as incorrect_count,
        SUM(is_bookmarked) as bookmarked_count
      FROM enriched_questions
    `;

    const result = await this.evaluateQuery(query);
    return this.parseCountResults(result);
  }

  /**
   * Get filtered count based on current selection
   * This is for the final count when user has made selections
   */
  async getFilteredQuestionCount(params: CountQueryParams): Promise<number> {
    const {
      userId,
      questionMode,
      selectedThemes = [],
      selectedSubthemes = [],
      selectedGroups = [],
    } = params;

    // Build WHERE conditions based on selections
    const conditions: string[] = [];

    if (selectedThemes.length > 0) {
      conditions.push(
        `q.TaxThemeId IN (${selectedThemes.map(id => `'${id}'`).join(', ')})`,
      );
    }

    if (selectedSubthemes.length > 0) {
      conditions.push(
        `q.TaxSubthemeId IN (${selectedSubthemes.map(id => `'${id}'`).join(', ')})`,
      );
    }

    if (selectedGroups.length > 0) {
      conditions.push(
        `q.TaxGroupId IN (${selectedGroups.map(id => `'${id}'`).join(', ')})`,
      );
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let query = '';

    switch (questionMode) {
      case 'all': {
        query = `
          SELECT COUNT(*) as count
          FROM questions q
          ${whereClause}
        `;
        break;
      }

      case 'unanswered': {
        query = `
          SELECT COUNT(*) as count
          FROM questions q
          LEFT JOIN userQuestionStats uqs ON q._id = uqs.questionId AND uqs.userId = '${userId}'
          ${whereClause}${whereClause ? ' AND' : 'WHERE'} uqs.questionId IS NULL
        `;
        break;
      }

      case 'incorrect': {
        query = `
          SELECT COUNT(*) as count
          FROM questions q
          INNER JOIN userQuestionStats uqs ON q._id = uqs.questionId 
          ${whereClause}${whereClause ? ' AND' : 'WHERE'} uqs.userId = '${userId}' AND uqs.isCorrect = false
        `;
        break;
      }

      case 'bookmarked': {
        query = `
          SELECT COUNT(*) as count
          FROM questions q
          INNER JOIN userBookmarks ub ON q._id = ub.questionId
          ${whereClause}${whereClause ? ' AND' : 'WHERE'} ub.userId = '${userId}'
        `;
        break;
      }
    }

    const result = await this.evaluateQuery(query);
    return result.data.length > 0 ? Number(result.data[0].count) : 0;
  }

  private parseCountResults(result: MaterializedQueryResult): QuestionCounts {
    const counts: QuestionCounts = {
      totalQuestions: 0,
      themesCounts: {},
      subthemesCounts: {},
      groupsCounts: {},
    };

    result.data.forEach((row: any) => {
      const {
        type,
        taxonomy_id,
        all_count,
        unanswered_count,
        incorrect_count,
        bookmarked_count,
      } = row;

      const countData = {
        all: Number(all_count),
        unanswered: Number(unanswered_count),
        incorrect: Number(incorrect_count),
        bookmarked: Number(bookmarked_count),
      };

      switch (type) {
        case 'total': {
          counts.totalQuestions = countData.all;
          break;
        }
        case 'theme': {
          counts.themesCounts[taxonomy_id] = countData;
          break;
        }
        case 'subtheme': {
          counts.subthemesCounts[taxonomy_id] = countData;
          break;
        }
        case 'group': {
          counts.groupsCounts[taxonomy_id] = countData;
          break;
        }
      }
    });

    return counts;
  }
}
