'use client';

import type { MDConnection } from '@motherduck/wasm-client';

/**
 * Validates a database name to prevent SQL injection
 * Only allows alphanumeric characters, underscores, dots, and hyphens
 * Must start with a letter or underscore
 */
function validateDatabaseName(database: string): boolean {
  // Check for null, undefined, or empty string
  if (!database || typeof database !== 'string') {
    return false;
  }

  // Check length (reasonable limit)
  if (database.length > 64) {
    return false;
  }

  // Check for valid SQL identifier pattern
  // Allow letters, numbers, underscores, dots (for schema.database), and hyphens
  // Must start with letter or underscore
  const validPattern = /^[a-zA-Z_][a-zA-Z0-9_.-]*$/;

  if (!validPattern.test(database)) {
    return false;
  }

  // Prevent SQL keywords and dangerous patterns
  const dangerousPatterns = [
    /;\s*drop/i,
    /;\s*delete/i,
    /;\s*update/i,
    /;\s*insert/i,
    /;\s*create/i,
    /;\s*alter/i,
    /;\s*truncate/i,
    /--/,
    /\/\*/,
    /\*\//,
    /'/,
    /"/,
    /`/,
    /\\/,
    /\0/,
    /\b/,
    /\t/,
    /\u001A/,
    /\n/,
    /\r/,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(database)) {
      return false;
    }
  }

  return true;
}

// Create a connection to MotherDuck to be used in the frontend throughout a session.
export default async function initMotherDuckConnection(
  mdToken: string,
  database?: string,
): Promise<MDConnection | undefined> {
  if (typeof Worker === 'undefined') {
    console.error('Web Workers are not supported in this environment.');
    return;
  }

  try {
    // Dynamically import MDConnection
    const motherduckWasmModule = await import('@motherduck/wasm-client').then(
      mod => mod,
    );

    if (!motherduckWasmModule.MDConnection) {
      console.error('Failed to load MDConnection');
      return;
    }

    const _connection = motherduckWasmModule.MDConnection.create({ mdToken });

    if (database) {
      // Validate database name to prevent SQL injection
      if (!validateDatabaseName(database)) {
        console.error('Invalid database name provided:', database);
        throw new Error(
          'Invalid database name: only alphanumeric characters, underscores, dots, and hyphens are allowed',
        );
      }

      // Since USE statements don't support parameterized queries in most SQL databases,
      // we validate the input and use string interpolation safely
      await _connection.evaluateQuery(`USE ${database}`);
    }

    return _connection;
  } catch (error) {
    console.error('Failed to create DuckDB connection', error);
  }
}
