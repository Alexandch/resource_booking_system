import pool from "../config/db.js";

export async function createReservation(req, res) {
    try{
    const { resource_id, start_time, end_time, purpose } = req.body;
    const user_id = req.user.id;

    console.log("Create reservation start:", req.body);

    const conflict = await pool.query(`
        SELECT 1 FROM reservations
        WHERE resource_id = $1
        AND tstzrange(start_time, end_time) && tstzrange($2, $3)
    `, [resource_id, start_time, end_time]);

    if (conflict.rows.length > 0)
        return res.status(400).json({ message: "Time slot busy" });

    await pool.query(`
        INSERT INTO reservations(user_id, resource_id, start_time, end_time, status, purpose)
        VALUES ($1, $2, $3, $4, 'approved', $5)
    `, [user_id, resource_id, start_time, end_time, purpose]);

    await delCache('cache:analytics:bookings_per_day');

    res.json({ message: "Reservation created" });
    }catch(error){
        console.error("Reservation error:", error);
        res.status(500).json({ error: error.message });
    }
}

export async function getMyReservations(req, res) {
    const user_id = req.user.id;

    const data = await pool.query(`
        SELECT r.*, res.start_time, res.end_time, res.status
        FROM reservations res
        JOIN resources r ON res.resource_id = r.id
        WHERE res.user_id = $1
        ORDER BY res.start_time DESC
    `, [user_id]);

    res.json(data.rows);
}
