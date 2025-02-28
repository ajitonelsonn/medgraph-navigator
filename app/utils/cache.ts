// utils/cache.ts
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Generic cache utility function that stores and retrieves data with expiration
 * @param key - Cache key for identification
 * @param fetchFn - Function that returns a Promise with the data to be cached
 * @returns Promise with the cached or freshly fetched data
 */
export async function getCachedData<T>(
  key: string,
  fetchFn: () => Promise<T>
): Promise<T> {
  // Check browser localStorage
  const cached = localStorage.getItem(key);

  if (cached) {
    const { data, timestamp } = JSON.parse(cached);

    // Check if cache is still valid
    if (Date.now() - timestamp < CACHE_TTL) {
      return data as T;
    }
  }

  // Fetch fresh data
  const freshData = await fetchFn();

  // Update cache
  localStorage.setItem(
    key,
    JSON.stringify({
      data: freshData,
      timestamp: Date.now(),
    })
  );

  return freshData;
}
