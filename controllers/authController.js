import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import redisClient from "../config/redisClient.js";
import connectMongo from '../config/mongo.js';
import Logger from '../services/logger.js';
connectMongo();

const MAX_ATTEMPTS = 3;
const BLOCK_TIME = 600; // 10 минут в секундах

export async function login(req, res) {
    try {
        const { login, password } = req.body;

        // 1. Проверить не заблокирован ли пользователь
        const blocked = await redisClient.get(`blocked:${login}`);
        if (blocked) {
            const ttl = await redisClient.ttl(`blocked:${login}`);
            const minutes = Math.ceil(ttl / 60);
            return res.status(403).json({
                message: `Слишком много неудачных попыток. Попробуйте через ${minutes} мин.`
            });
        }

        // 2.Вытащить пользователя из БД
        const user = await pool.query(
            "SELECT * FROM users WHERE login = $1",
            [login]
        );

        if (user.rows.length === 0) {
            await handleFailedAttempt(login);
            return res.status(400).json({ message: "Пользователь не найден" });
        }

        const userData = user.rows[0];

        if (user.rows.length === 0) {
            await Logger.info({
                action: 'LOGIN_FAILED',
                description: `Попытка входа с несуществующим логином: ${login}`,
                metadata: { login, ip: req.ip }
            });
            return res.status(400).json({ message: "Пользователь не найден" });
        }

        const valid = await bcrypt.compare(password, user.rows[0].password_hash);
        if (!valid) {
            await Logger.info({
                userId: user.rows[0].id,
                action: 'LOGIN_FAILED',
                description: `Неверный пароль для пользователя ${login}`,
                metadata: { login, ip: req.ip }
            });
            return res.status(400).json({ message: "Неверный пароль" });
        }

        // Успешный вход
        await Logger.info({
            userId: user.rows[0].id,
            action: 'LOGIN',
            description: `Пользователь ${login} вошёл в систему`,
            metadata: { ip: req.ip, userAgent: req.headers['user-agent'] }
        });

        // Успешный вход – сбрасить все счётчики
        await redisClient.del(`attempts:${login}`);
        await redisClient.del(`blocked:${login}`);

        // Генерация токена
        const token = jwt.sign(
            {
                id: userData.id,
                role_id: userData.role_id
            },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
        );

        return res.json({
            token,
            role: userData.role_id === 1 ? "admin" : "user"
        });

    } catch (err) {
        console.error("LOGIN ERROR:", err);
        return res.status(500).json({ message: "Ошибка сервера" });
    }
}

// Вспомогательная функция для обработки неудачной попытки
async function handleFailedAttempt(login) {
    const attemptsKey = `attempts:${login}`;
    let attempts = await redisClient.get(attemptsKey);
    attempts = attempts ? parseInt(attempts) : 0;
    attempts++;

    if (attempts >= MAX_ATTEMPTS) {
        // Блокир польз на BLOCK_TIME секунд
        await redisClient.setex(`blocked:${login}`, BLOCK_TIME, '1');
        // Удалить счётчик попыток, чтобы не мешал
        await redisClient.del(attemptsKey);
    } else {
        // Установить или обновить счётчик с TTL (тоже 10 минут)
        await redisClient.setex(attemptsKey, BLOCK_TIME, attempts);
    }
}

export async function register(req, res) {
    const { login, password, email, first_name, last_name } = req.body;

    const hash = await bcrypt.hash(password, 10);

    await pool.query(
        `INSERT INTO users(login, password_hash, email, first_name, last_name, role_id)
         VALUES ($1, $2, $3, $4, $5, 2)`,
        [login, hash, email, first_name, last_name]
    );

    await Logger.info({
        action: 'REGISTER',
        description: `Зарегистрирован новый пользователь: ${login}`,
        metadata: { login, email, first_name, last_name, ip: req.ip }
    });

    res.json({ message: "Пользователь создан" });
}

export async function logout(req, res) {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    const decoded = jwt.decode(token);
    if (decoded && decoded.exp) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await redisClient.setex(`blacklist:${token}`, ttl, '1');
      }
    }
  }
  res.json({ message: 'Вы вышли из системы' });
}