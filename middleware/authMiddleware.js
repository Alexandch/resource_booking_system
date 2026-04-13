import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { getCache, setCache } from '../services/cacheService.js';
import redisClient from '../config/redisClient.js';

export default async function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({ message: 'Session expired. Please login again.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const cacheKey = `cache:session:${decoded.id}`;

    // Пытаемся получить данные пользователя из кэша
    let user = await getCache(cacheKey);
    if (!user) {
      // Если нет в кэше, загружаем из БД
      const result = await pool.query(
        'SELECT id, role_id FROM users WHERE id = $1',
        [decoded.id]
      );
      if (result.rows.length === 0) {
        return res.status(401).json({ message: 'User not found' });
      }
      user = result.rows[0];
      // Сохраняем в кэш на 24 часа (время жизни сессии)
      await setCache(cacheKey, user, 86400);
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(401).json({ message: 'Invalid token' });
  }
}