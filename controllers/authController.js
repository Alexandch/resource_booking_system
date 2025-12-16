import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export async function login(req, res) {
    try {
        const { login, password } = req.body;

        const user = await pool.query(
            "SELECT * FROM users WHERE login = $1",
            [login]
        );

        if (user.rows.length === 0)
            return res.status(400).json({ message: "User not found" });

        const valid = await bcrypt.compare(password, user.rows[0].password_hash);
        if (!valid) return res.status(400).json({ message: "Wrong password" });

        const token = jwt.sign(
            {
                id: user.rows[0].id,
                role_id: user.rows[0].role_id
            },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
        );

        return res.json({
            token,
            role: user.rows[0].role_id === 1 ? "admin" : "user"
        });
    } catch (err) {
        console.error("LOGIN ERROR:", err);
        return res.status(500).json({ message: "Server error" });
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

    res.json({ message: "User created" });
}
