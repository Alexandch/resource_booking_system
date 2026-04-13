import redisClient from '../config/redisClient.js';

export default async function checkBlacklist(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return next(); // нет токена – пропускаем (далее authMiddleware обработает)

  const isBlacklisted = await redisClient.get(`blacklist:${token}`);
  if (isBlacklisted) {
    return res.status(401).json({ message: 'Сессия истекла. Войдите снова.' });
  }
  next();
}