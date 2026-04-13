import pool from "../config/db.js";
import { getCache, setCache, delCache } from '../services/cacheService.js';
import { publishInvalidation } from '../services/redisPubSub.js';
import bcrypt from "bcryptjs";
import Logger from '../services/logger.js';
import connectMongo from '../config/mongo.js';

connectMongo();
// Получить всех пользователей
export async function getUsers(req, res) {
  const cacheKey = 'cache:users:list';

  // Пытаемся получить из кэша
  const cached = await getCache(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  // Если в кэше нет, идём в БД
  const q = await pool.query("SELECT * FROM users ORDER BY id");
  const users = q.rows;

  // Сохраняем в кэш на 5 минут (TTL можно задать явно или использовать DEFAULT)
  await setCache(cacheKey, users, 300);

  res.json(users);
}

// Создать пользователя
export async function createUser(req, res) {
  const { login, password, email, first_name, last_name, role_id } = req.body;

  if (!login || !password)
    return res.status(400).json({ message: "login and password required" });

  const hash = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO users (login, password_hash, email, first_name, last_name, role_id)
         VALUES ($1,$2,$3,$4,$5,$6)`,
    [login, hash, email, first_name, last_name, role_id || 2]
  );

  await Logger.info({
    userId: req.user.id, // кто создаёт
    action: 'CREATE_USER',
    description: `Создан пользователь с логином: ${login}`,
    metadata: { createdUser: { login, email, first_name, last_name, role_id } }
  });

  await delCache('cache:users:list');
  publishInvalidation('user');
  res.json({ message: "User created" });
}

// Удалить пользователя
export async function deleteUser(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Удаляем все записи из detailed_logs, ссылающиеся на этого пользователя
    await client.query("DELETE FROM detailed_logs WHERE user_id = $1", [req.params.id]);

    // 2. Удаляем самого пользователя
    const result = await client.query("DELETE FROM users WHERE id = $1 RETURNING id", [req.params.id]);

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    await Logger.info({
      userId: req.user.id,
      action: 'DELETE_USER',
      description: `Удалён пользователь с ID: ${req.params.id}`,
      metadata: { deletedUserId: req.params.id }
    });

    await client.query('COMMIT');

    // 3. Инвалидируем кэш
    await delCache('cache:users:list');
    await delCache(`cache:session:${req.params.id}`);
    publishInvalidation('user', req.params.id);

    res.json({ message: "User deleted" });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Ошибка при удалении пользователя:", error);
    res.status(500).json({ message: "Ошибка сервера: " + error.message });
  } finally {
    client.release();
  }
}

// Сменить роль
export async function toggleRole(req, res) {
  const user = await pool.query("SELECT role_id FROM users WHERE id=$1", [req.params.id]);
  if (user.rows.length === 0) return res.status(404).json({ message: "User not found" });

  const newRole = user.rows[0].role_id === 1 ? 2 : 1;

  await pool.query("UPDATE users SET role_id=$1 WHERE id=$2", [newRole, req.params.id]);

  await Logger.info({
    userId: req.user.id,
    action: 'CHANGE_ROLE',
    description: `Изменена роль пользователя ID=${req.params.id} на ${newRole}`,
    metadata: { targetUserId: req.params.id, newRole }
  });

  await delCache('cache:users:list');
  await delCache(`cache:session:${req.params.id}`);
  res.json({ message: "Role changed", newRole });
}

// Блокировка / разблокировка
export async function toggleBlock(req, res) {
  const user = await pool.query("SELECT is_blocked FROM users WHERE id=$1", [req.params.id]);
  if (user.rows.length === 0) return res.status(404).json({ message: "User not found" });

  const newState = !user.rows[0].is_blocked;

  await pool.query("UPDATE users SET is_blocked=$1 WHERE id=$2", [
    newState,
    req.params.id,
  ]);

  await Logger.info({
    userId: req.user.id,
    action: newState ? 'BLOCK_USER' : 'UNBLOCK_USER',
    description: `Пользователь ID=${req.params.id} ${newState ? 'заблокирован' : 'разблокирован'}`,
    metadata: { targetUserId: req.params.id, is_blocked: newState }
  });

  await delCache('cache:users:list');
  await delCache(`cache:session:${req.params.id}`);
  res.json({ message: newState ? "Blocked" : "Unblocked", is_blocked: newState });
}

// Логи
export async function getLogs(req, res) {
  const q = await pool.query("SELECT * FROM logs ORDER BY created_at DESC");
  res.json(q.rows);
}

// Получить ресурс по ID (для редактирования)
export async function getResourceById(req, res) {
  const { id } = req.params;

  try {
    const q = await pool.query(
      `SELECT r.*, rt.name as type_name, b.name as location
       FROM resources r
       LEFT JOIN resource_types rt ON r.type_id = rt.id
       LEFT JOIN buildings b ON r.building_id = b.id
       WHERE r.id = $1`,
      [id]
    );

    if (q.rows.length === 0) {
      return res.status(404).json({ message: "Resource not found" });
    }

    res.json(q.rows[0]);
  } catch (error) {
    console.error('Error fetching resource:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
}

// Обновить ресурс
export async function updateResource(req, res) {
  const { id } = req.params;
  const { name, type_name, capacity, location } = req.body;

  try {
    // Валидация
    if (!name || !type_name || !capacity || !location) {
      return res.status(400).json({ message: "Все поля обязательны для заполнения" });
    }

    // Получаем ID типа ресурса по названию
    const typeResult = await pool.query(
      "SELECT id FROM resource_types WHERE name = $1",
      [type_name]
    );

    if (typeResult.rows.length === 0) {
      return res.status(400).json({
        message: "Указанный тип ресурса не найден",
        availableTypes: await getAvailableTypes() // опционально
      });
    }

    const type_id = typeResult.rows[0].id;

    // Получаем ID здания по названию
    const buildingResult = await pool.query(
      "SELECT id FROM buildings WHERE name = $1",
      [location]
    );

    if (buildingResult.rows.length === 0) {
      return res.status(400).json({
        message: "Указанное здание не найдено",
        availableBuildings: await getAvailableBuildings() // опционально
      });
    }

    const building_id = buildingResult.rows[0].id;

    // Обновляем ресурс
    const result = await pool.query(
      `UPDATE resources
       SET name = $1,
           type_id = $2,
           capacity = $3,
           building_id = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, name, capacity`,
      [name, type_id, capacity, building_id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Ресурс не найден" });
    }

    await Logger.info({
      userId: req.user.id,
      action: 'UPDATE_RESOURCE',
      description: `Обновлён ресурс: ${name} (ID: ${id})`,
      metadata: { resourceId: id, name, type_name, capacity, location }
    });

    await delCache('cache:resources:list');
    await delCache(`cache:resource:${id}`);
    publishInvalidation('resource', id);
    res.json({
      message: "Ресурс успешно обновлён",
      resource: {
        id: result.rows[0].id,
        name: result.rows[0].name,
        capacity: result.rows[0].capacity,
        type_name,
        location
      }
    });

  } catch (error) {
    console.error('Error updating resource:', error);

    if (error.code === '23505') { // unique_violation в PostgreSQL
      return res.status(400).json({
        message: "Ресурс с таким названием уже существует"
      });
    }

    res.status(500).json({
      message: "Внутренняя ошибка сервера",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Вспомогательные функции (опционально, для лучшего UX)
async function getAvailableTypes() {
  const result = await pool.query("SELECT name FROM resource_types ORDER BY name");
  return result.rows.map(row => row.name);
}

async function getAvailableBuildings() {
  const result = await pool.query("SELECT name FROM buildings ORDER BY name");
  return result.rows.map(row => row.name);
}

// Получить все типы ресурсов (с кэшированием на 1 час)
export async function getResourceTypes(req, res) {
  const cacheKey = 'cache:resource_types:list';
  const cached = await getCache(cacheKey);
  if (cached) return res.json(cached);

  const result = await pool.query("SELECT id, name FROM resource_types ORDER BY name");
  await setCache(cacheKey, result.rows, 3600); // 1 час
  res.json(result.rows);
}

// Получить все здания (с кэшированием на 1 час)
export async function getBuildings(req, res) {
  const cacheKey = 'cache:buildings:list';
  const cached = await getCache(cacheKey);
  if (cached) return res.json(cached);

  const result = await pool.query("SELECT id, name FROM buildings ORDER BY name");
  await setCache(cacheKey, result.rows, 3600);
  res.json(result.rows);
}
