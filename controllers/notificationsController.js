import pool from "../config/db.js";

export async function getMyNotifications(req, res) {
    const user_id = req.user.id;

    const data = await pool.query(`
        SELECT * FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
    `, [user_id]);

    res.json(data.rows);
}
