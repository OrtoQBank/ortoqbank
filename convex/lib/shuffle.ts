/**
 * Shuffle utilities for random selection in quiz generation.
 * Supports both non-deterministic (Math.random) and deterministic (seeded) modes.
 */

// =============================================================================
// SEEDED PRNG
// =============================================================================

/**
 * Mulberry32 - fast, simple seeded PRNG.
 * Produces deterministic sequence of pseudo-random numbers from a seed.
 */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    let t = (state += 0x6D_2B_79_F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Create a seeded random generator from a string seed.
 * If no seed provided, returns Math.random for non-deterministic behavior.
 */
export function createSeededRandom(seed?: string): () => number {
  if (!seed) return Math.random;
  // Convert string to number using djb2 hash
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = Math.trunc((hash << 5) + hash + seed.codePointAt(i)!);
  }
  return mulberry32(hash >>> 0);
}

// =============================================================================
// SHUFFLE FUNCTIONS
// =============================================================================

/**
 * Fisher-Yates (Knuth) shuffle algorithm.
 * Produces an unbiased random permutation of the array.
 *
 * @param array - The array to shuffle
 * @param random - Optional random function (defaults to Math.random)
 * @returns A new array with elements in random order
 */
export function shuffleArray<T>(
  array: readonly T[],
  random: () => number = Math.random,
): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Select n random elements from an array using Fisher-Yates partial shuffle.
 * More efficient than shuffling the entire array when n << array.length.
 *
 * @param array - The array to select from
 * @param count - Number of elements to select
 * @param random - Optional random function (defaults to Math.random)
 * @returns A new array with count random elements
 */
export function selectRandom<T>(
  array: readonly T[],
  count: number,
  random: () => number = Math.random,
): T[] {
  if (count >= array.length) {
    return shuffleArray(array, random);
  }

  if (count <= 0) {
    return [];
  }

  // For very small selections relative to array size, use reservoir sampling
  if (count * 10 < array.length) {
    return reservoirSample(array, count, random);
  }

  // For moderate selections, use partial Fisher-Yates
  const shuffled = [...array];
  const result: T[] = [];

  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(random() * (shuffled.length - i));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    result.push(shuffled[i]);
  }

  return result;
}

/**
 * Reservoir sampling algorithm (Algorithm R).
 * Efficient for selecting k items from a stream or when k << n.
 */
function reservoirSample<T>(
  array: readonly T[],
  k: number,
  random: () => number = Math.random,
): T[] {
  if (k <= 0) return [];
  if (k >= array.length) return shuffleArray(array, random);

  const reservoir: T[] = [];

  // Fill reservoir with first k elements
  for (let i = 0; i < k; i++) {
    reservoir.push(array[i]);
  }

  // Process remaining elements
  for (let i = k; i < array.length; i++) {
    const j = Math.floor(random() * (i + 1));
    if (j < k) {
      reservoir[j] = array[i];
    }
  }

  return reservoir;
}

/**
 * Select random elements from a Set.
 * Converts to array internally for random access.
 */
export function selectRandomFromSet<T>(
  set: Set<T>,
  count: number,
  random: () => number = Math.random,
): T[] {
  return selectRandom([...set], count, random);
}

/**
 * Shuffle and limit to max count. Convenience helper.
 */
export function shuffleAndLimit<T>(
  array: readonly T[],
  maxCount: number,
  random: () => number = Math.random,
): T[] {
  return array.length <= maxCount
    ? shuffleArray(array, random)
    : selectRandom(array, maxCount, random);
}
