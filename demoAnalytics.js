import fetch from 'node-fetch';

const baseUrl = 'http://localhost:3000/api/analytics';
const endpoints = [
  '/activity?period=day',
  '/top-users?limit=5',
  '/actions',
  '/timeseries?interval=hour',
  '/anomalies?threshold=50'
];

(async () => {
  for (const endpoint of endpoints) {
    console.log(`\nЗапрос: ${endpoint}`);
    try {
      const res = await fetch(`${baseUrl}${endpoint}`);
      const data = await res.json();
      console.log('Ответ:', JSON.stringify(data, null, 2).slice(0, 500) + '...');
    } catch (err) {
      console.error('Ошибка:', err.message);
    }
  }
})();