import 'dotenv/config';
import redisClient from './config/redisClient.js';

const API_URL = 'http://localhost:3000/api';
let authToken = null;

const log = (step, data) => {
  console.log(`\n🔹 ${step}`);
  console.log(data);
};

async function login() {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'admin2', password: 'admin123' }) 
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    authToken = data.token;
    log('Успешный вход', { token: authToken?.slice(0, 50) + '...', role: data.role });
    return true;
  } catch (error) {
    log('Ошибка входа', error.message);
    return false;
  }
}

async function testProtectedRequest() {
  try {
    const response = await fetch(`${API_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    log('Защищённый запрос ДО выхода', { status: response.status, usersCount: data.length });
    return true;
  } catch (error) {
    log('Защищённый запрос ДО выхода не удался', error.message);
    return false;
  }
}

async function testPubSub() {
  await fetch(`${API_URL}/admin/users`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  const cacheKeyExistsBefore = await redisClient.exists('cache:users:list');
  log('Кэш списка пользователей ДО создания', cacheKeyExistsBefore ? 'существует' : 'не существует');

  const newUser = {
    login: `test_${Date.now()}`,
    password: 'test123',
    email: `test_${Date.now()}@example.com`,
    first_name: 'Test',
    last_name: 'User',
    role_id: 2
  };

  try {
    const response = await fetch(`${API_URL}/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify(newUser)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    log('Создан тестовый пользователь', newUser.login);
  } catch (error) {
    log('Ошибка создания пользователя', error.message);
    return false;
  }

  await new Promise(resolve => setTimeout(resolve, 500));
  const cacheKeyExistsAfter = await redisClient.exists('cache:users:list');
  const success = !cacheKeyExistsAfter;
  log('Кэш списка пользователей ПОСЛЕ создания', success ? '✅ удалён (инвалидация сработала)' : 'всё ещё существует (ошибка)');
  return success;
}

async function logout() {
  try {
    const response = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    log('Выход из системы', data);
    return true;
  } catch (error) {
    log('Ошибка при выходе', error.message);
    return false;
  }
}

async function testProtectedRequestAfterLogout() {
  try {
    const response = await fetch(`${API_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (response.status === 401) {
      log('Защищённый запрос ПОСЛЕ выхода', '✅ Токен отклонён (401) – чёрный список работает');
      return true;
    } else {
      log('Защищённый запрос ПОСЛЕ выхода (НЕ ДОЛЖЕН УДАСТЬСЯ)', { status: response.status });
      return false;
    }
  } catch (error) {
    log('Неожиданная ошибка', error.message);
    return false;
  }
}

async function showBlacklistKeys() {
  const blacklistKeys = await redisClient.keys('blacklist:*');
  log('Ключи чёрного списка в Redis', blacklistKeys.length ? blacklistKeys : 'нет (но после выхода должны быть)');
}

async function runDemo() {
  console.log('Автоматическая демонстрация чёрного списка JWT и Pub/Sub\n');
  try {
    await redisClient.ping();
    console.log('✅ Redis доступен');
  } catch (err) {
    console.error('❌ Redis не доступен', err.message);
    process.exit(1);
  }

  const loggedIn = await login();
  if (!loggedIn) process.exit(1);

  const protectedWorks = await testProtectedRequest();
  if (!protectedWorks) process.exit(1);

  const pubsubSuccess = await testPubSub();
  if (!pubsubSuccess) console.warn('⚠️ Pub/Sub не сработал как ожидалось');

  const loggedOut = await logout();
  if (!loggedOut) process.exit(1);

  const protectedBlocked = await testProtectedRequestAfterLogout();
  if (!protectedBlocked) {
    console.error('❌ Чёрный список не сработал');
  } else {
    console.log('✅ Чёрный список JWT работает корректно.');
  }

  await showBlacklistKeys();

  process.exit(0);
}

runDemo().catch(console.error);