/**
 * Shuffle utilities for random selection in quiz generation.
 * Separated from main quiz creation logic for clarity and reusability.
 */

/**
 * Fisher-Yates (Knuth) shuffle algorithm.
 * Produces an unbiased random permutation of the array.
 *
 * Time complexity: O(n)
 * Space complexity: O(n) - creates a copy
 *
 * @param array - The array to shuffle
 * @returns A new array with elements in random order
 */
export function shuffleArray<T>(array: readonly T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Select n random elements from an array using Fisher-Yates partial shuffle.
 * More efficient than shuffling the entire array when n << array.length.
 *
 * Time complexity: O(min(n, array.length))
 * Space complexity: O(array.length)
 *
 * @param array - The array to select from
 * @param count - Number of elements to select
 * @returns A new array with count random elements
 */
export function selectRandom<T>(array: readonly T[], count: number): T[] {
  if (count >= array.length) {
    return shuffleArray(array);
  }

  if (count <= 0) {
    return [];
  }

  // For very small selections relative to array size, use reservoir sampling
  if (count * 10 < array.length) {
    return reservoirSample(array, count);
  }

  // For moderate selections, use partial Fisher-Yates
  const shuffled = [...array];
  const result: T[] = [];

  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(Math.random() * (shuffled.length - i));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    result.push(shuffled[i]);
  }

  return result;
}

/**
 * Reservoir sampling algorithm (Algorithm R).
 * Efficient for selecting k items from a stream or when k << n.
 *
 * Time complexity: O(n)
 * Space complexity: O(k)
 *
 * @param array - The array to sample from
 * @param k - Number of elements to select
 * @returns A new array with k random elements
 */
function reservoirSample<T>(array: readonly T[], k: number): T[] {
  if (k <= 0) return [];
  if (k >= array.length) return shuffleArray(array);

  const reservoir: T[] = [];

  // Fill reservoir with first k elements
  for (let i = 0; i < k; i++) {
    reservoir.push(array[i]);
  }

  // Process remaining elements
  for (let i = k; i < array.length; i++) {
    const j = Math.floor(Math.random() * (i + 1));
    if (j < k) {
      reservoir[j] = array[i];
    }
  }

  return reservoir;
}

/**
 * Select random elements from a Set.
 * Converts to array internally for random access.
 *
 * @param set - The set to select from
 * @param count - Number of elements to select
 * @returns A new array with count random elements
 */
export function selectRandomFromSet<T>(set: Set<T>, count: number): T[] {
  return selectRandom([...set], count);
}

