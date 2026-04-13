import redisClient from '../config/redisClient.js';

// Базовый TTL по умолчанию (5 минут)
const DEFAULT_TTL = 300;

/**
 * Получить данные из кэша по ключу
 * @param {string} key
 * @returns {Promise<object|null>}
 */
export async function getCache(key) {
  const data = await redisClient.get(key);
  return data ? JSON.parse(data) : null;
}

/**
 * Сохранить данные в кэш с указанным TTL
 * @param {string} key
 * @param {any} value
 * @param {number} ttl - время жизни в секундах
 */
export async function setCache(key, value, ttl = DEFAULT_TTL) {
  await redisClient.setex(key, ttl, JSON.stringify(value));
}

/**
 * Удалить один ключ из кэша
 * @param {string} key
 */
export async function delCache(key) {
  await redisClient.del(key);
}

/**
 * Удалить все ключи, соответствующие шаблону (например, "cache:users:*")
 * Используем SCAN для безопасного удаления в production
 * @param {string} pattern
 */
export async function delCacheByPattern(pattern) {
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    if (keys.length) {
      await redisClient.del(...keys);
    }
    cursor = nextCursor;
  } while (cursor !== '0');
}