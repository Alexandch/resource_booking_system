import redisClient from '../config/redisClient.js';
import { delCache, delCacheByPattern } from './cacheService.js';

const CHANNEL = 'cache:invalidation';

// Публикация события об изменении данных
export function publishInvalidation(entityType, entityId = null) {
  const message = JSON.stringify({ entityType, entityId, timestamp: Date.now() });
  redisClient.publish(CHANNEL, message);
  console.log(`📢 Published: ${entityType} ${entityId || 'ALL'}`);
}

// Подписка на события и обработка инвалидации
export function subscribeToInvalidation() {
  const subscriber = redisClient.duplicate(); // отдельное соединение для подписки
  subscriber.subscribe(CHANNEL, (err, count) => {
    if (err) console.error('Subscription error:', err);
    else console.log(`✅ Subscribed to ${CHANNEL}`);
  });

  subscriber.on('message', async (channel, message) => {
    if (channel !== CHANNEL) return;
    const { entityType, entityId } = JSON.parse(message);
    console.log(`🔄 Invalidation event: ${entityType} ${entityId || 'ALL'}`);

    // Инвалидация кэша в зависимости от типа сущности
    switch (entityType) {
      case 'user':
        await delCache('cache:users:list');
        if (entityId) await delCache(`cache:session:${entityId}`);
        break;
      case 'resource':
        await delCache('cache:resources:list');
        if (entityId) await delCache(`cache:resource:${entityId}`);
        break;
      case 'booking':
        await delCache('cache:analytics:bookings_per_day');
        break;
      case 'resource_type':
        await delCache('cache:resource_types:list');
        break;
      case 'building':
        await delCache('cache:buildings:list');
        break;
      default:
        // общая инвалидация по шаблону, если нужно
        await delCacheByPattern(`cache:${entityType}:*`);
    }
  });
}