import pool from "../config/db.js";
import bcrypt from "bcryptjs";

// Получить всех пользователей
export async function getUsers(req, res) {
    const q = await pool.query("SELECT * FROM users ORDER BY id");
    res.json(q.rows);
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

    res.json({ message: "User created" });
}

// Удалить пользователя
export async function deleteUser(req, res) {
    await pool.query("DELETE FROM users WHERE id=$1", [req.params.id]);
    res.json({ message: "User deleted" });
}

// Сменить роль
export async function toggleRole(req, res) {
    const user = await pool.query("SELECT role_id FROM users WHERE id=$1", [req.params.id]);
    if (user.rows.length === 0) return res.status(404).json({ message: "User not found" });

    const newRole = user.rows[0].role_id === 1 ? 2 : 1;

    await pool.query("UPDATE users SET role_id=$1 WHERE id=$2", [newRole, req.params.id]);

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

    res.json({ message: newState ? "Blocked" : "Unblocked", is_blocked: newState });
}

// Логи
export async function getLogs(req, res) {
    const q = await pool.query("SELECT * FROM logs ORDER BY created_at DESC");
    res.json(q.rows);
}
