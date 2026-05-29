const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  enableOfflineQueue: false,
  retryStrategy: () => null, // nie blokuj startu jesli redis niedostepny
});

redis.on('connect', () => console.log('polaczono z redis'));
redis.on('error', (err) => console.warn('redis niedostepny:', err.message));

redis.connect().catch(() => {});

module.exports = redis;
