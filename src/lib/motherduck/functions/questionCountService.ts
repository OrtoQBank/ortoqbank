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
   * Fetch all question counts - just basic count for now
   */
  async fetchAllBaseCounts(userId: string): Promise<QuestionCounts> {
    const query = `SELECT COUNT(*) AS total_questions FROM my_db.questions`;

    const result = await this.evaluateQuery(query);

    // Access Arrow/RecordBatch data structure
    let totalCount = 0;
    const data = result.data as any;

    try {
      // MotherDuck returns Arrow format with batches containing RecordBatch objects
      if (data?.batches && data.batches.length > 0) {
        const batch = data.batches[0];
        const recordBatch = batch.recordBatch;

        // Access the first column (COUNT(*)) from the first row
        if (recordBatch && recordBatch.numRows > 0) {
          // Get the first column (our COUNT result)
          const countColumn = recordBatch.getChildAt(0);
          if (countColumn && countColumn.length > 0) {
            totalCount = Number(countColumn.get(0));
          }
        }
      }
    } catch (error) {
      console.error('Error parsing Arrow result:', error);
    }

    return {
      totalQuestions: totalCount,
      themesCounts: {},
      subthemesCounts: {},
      groupsCounts: {},
    };
  }

  /**
   * Get filtered count - just returns total count for now
   */
  async getFilteredQuestionCount(params: CountQueryParams): Promise<number> {
    const query = `SELECT COUNT(*) AS total_questions FROM my_db.questions`;

    const result = await this.evaluateQuery(query);

    // Use the same Arrow data access logic as fetchAllBaseCounts
    let totalCount = 0;
    const data = result.data as any;

    try {
      if (data?.batches && data.batches.length > 0) {
        const batch = data.batches[0];
        const recordBatch = batch.recordBatch;

        if (recordBatch && recordBatch.numRows > 0) {
          const countColumn = recordBatch.getChildAt(0);
          if (countColumn && countColumn.length > 0) {
            totalCount = Number(countColumn.get(0));
          }
        }
      }
    } catch (error) {
      console.error('Error parsing filtered count result:', error);
    }

    return totalCount;
  }

  private parseCountResults(result: MaterializedQueryResult): QuestionCounts {
    const counts: QuestionCounts = {
      totalQuestions: 0,
      themesCounts: {},
      subthemesCounts: {},
      groupsCounts: {},
    };

    // Convert MotherDuck result to array format
    const rows = [...(result.data as any)];
    rows.forEach((row: any) => {
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
