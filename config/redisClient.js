import Redis from 'ioredis';
import { subscribeToInvalidation } from '../services/redisPubSub.js';

const redisClient = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD, 
  retryStrategy: (times) => {
    if (times > 3) {
      console.error('Redis connection lost. Giving up.');
      return null; 
    }
    return Math.min(times * 100, 3000); 
  }
});
redisClient.ping().then(res => console.log('Redis ping:', res));
redisClient.on('connect', () => console.log('✅ Connected to Redis'));
redisClient.on('error', (err) => console.error('❌ Redis error:', err));

export default redisClient;

subscribeToInvalidation();