/**
 * Normalizes text by removing accents and non-alphanumeric characters
 * This is useful for generating clean prefixes for use in IDs
 */
export const normalizeText = (text: string): string => {
  if (!text) return '';

  // Handle special characters that might not be properly caught by normalize
  const specialCharsMap: Record<string, string> = {
    Ê: 'E',
    ê: 'e',
    Ë: 'E',
    ë: 'e',
    É: 'E',
    é: 'e',
    È: 'E',
    è: 'e',
    Á: 'A',
    á: 'a',
    À: 'A',
    à: 'a',
    Ã: 'A',
    ã: 'a',
    Â: 'A',
    â: 'a',
    Ä: 'A',
    ä: 'a',
    Í: 'I',
    í: 'i',
    Ì: 'I',
    ì: 'i',
    Î: 'I',
    î: 'i',
    Ï: 'I',
    ï: 'i',
    Ó: 'O',
    ó: 'o',
    Ò: 'O',
    ò: 'o',
    Õ: 'O',
    õ: 'o',
    Ô: 'O',
    ô: 'o',
    Ö: 'O',
    ö: 'o',
    Ú: 'U',
    ú: 'u',
    Ù: 'U',
    ù: 'u',
    Û: 'U',
    û: 'u',
    Ü: 'U',
    ü: 'u',
    Ç: 'C',
    ç: 'c',
    Ñ: 'N',
    ñ: 'n',
    '.': '',
    ' ': '',
    '-': '',
    _: '',
    '/': '',
    '\\': '',
    ',': '',
    ';': '',
    ':': '',
    '!': '',
    '?': '',
    '@': '',
    '#': '',
    $: '',
    '%': '',
    '&': '',
    '*': '',
    '(': '',
    ')': '',
    '[': '',
    ']': '',
    '{': '',
    '}': '',
    '<': '',
    '>': '',
    '=': '',
    '+': '',
    '|': '',
    '`': '',
    '~': '',
    '^': '',
    '"': '',
    "'": '',
  };

  // First replace direct mappings for special characters
  let result = text;
  for (const [char, replacement] of Object.entries(specialCharsMap)) {
    result = result.split(char).join(replacement);
  }

  // Then apply standard normalization for any remaining accents
  return result
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036F]/g, '') // Remove remaining accents
    .replaceAll(/[^a-zA-Z0-9]/g, ''); // Remove any remaining non-alphanumeric characters
};

/**
 * Generates a default prefix from a name
 * @param name The name to generate a prefix from
 * @param length The number of characters to use for the prefix
 * @returns The generated prefix in uppercase
 */
export const generateDefaultPrefix = (name: string, length: number): string => {
  return normalizeText(name).slice(0, length).toUpperCase();
};

/**
 * Reference configuration type for checking dependencies
 */
export type ReferenceConfig = {
  table: string;
  indexName: string;
  fieldName: string;
  errorMessage: string;
};

// Type for Convex query object
type QueryBuilder = {
  eq: (field: string, value: any) => any;
  field: (fieldName: string) => string;
};

/**
 * Checks if an entity can be safely deleted by examining dependencies across tables
 * @param ctx The Convex context
 * @param entityId The ID of the entity to check
 * @param entityTable The table name of the entity
 * @param dependencies Array of reference configurations to check
 * @returns true if entity can be deleted, throws an error with message if not
 */
export async function canSafelyDelete(
  ctx: any,
  entityId: any,
  entityTable: string,
  dependencies: ReferenceConfig[],
): Promise<boolean> {
  // First check if the entity exists
  const entity = await ctx.db.get(entityId);
  if (!entity) {
    throw new Error(
      `${entityTable.charAt(0).toUpperCase() + entityTable.slice(1, -1)} not found`,
    );
  }

  // Check each dependency
  for (const dependency of dependencies) {
    let query = ctx.db.query(dependency.table);

    // Use index if provided, otherwise use filter
    query = dependency.indexName
      ? query.withIndex(dependency.indexName, (q: QueryBuilder) =>
          q.eq(dependency.fieldName, entityId),
        )
      : query.filter((q: QueryBuilder) =>
          q.eq(q.field(dependency.fieldName), entityId),
        );

    // Execute query
    const referencingDocs = await query.collect();

    // Check if there are any referencing documents
    if (referencingDocs.length > 0) {
      throw new Error(dependency.errorMessage);
    }
  }

  // If we get here, it means no dependencies were found
  return true;
}

// Helper function to get ISO week string from timestamp following ISO 8601 standards
export function getWeekString(timestamp: number): string {
  const date = new Date(timestamp);

  // Adjust to nearest Thursday (ISO week date system)
  // Thursday is day 4 in ISO (Monday=1, Tuesday=2, ..., Sunday=7)
  const dayOfWeek = (date.getDay() + 6) % 7; // Convert Sunday=0 to Sunday=6, Monday=0
  const nearestThursday = new Date(date.getTime());
  nearestThursday.setDate(date.getDate() - dayOfWeek + 3); // Adjust to Thursday

  // Get the year of the Thursday (this determines the ISO year)
  const isoYear = nearestThursday.getFullYear();

  // Find the first Thursday of the ISO year (which is in the first ISO week)
  const jan4 = new Date(isoYear, 0, 4);
  const firstThursday = new Date(jan4.getTime());
  const jan4DayOfWeek = (jan4.getDay() + 6) % 7; // Convert to Monday=0 system
  firstThursday.setDate(4 - jan4DayOfWeek + 3); // Adjust to first Thursday

  // Calculate week number
  const weekNumber =
    Math.floor(
      (nearestThursday.getTime() - firstThursday.getTime()) /
        (7 * 24 * 60 * 60 * 1000),
    ) + 1;

  return `${isoYear}-W${weekNumber.toString().padStart(2, '0')}`;
}

//question text and explanation text are not allowed to contain blobs
export const validateNoBlobs = (content: any[]) => {
  for (const node of content) {
    if (node.type === 'image' && node.attrs?.src?.startsWith('blob:')) {
      throw new Error('Invalid image URL detected');
    }
  }
};
