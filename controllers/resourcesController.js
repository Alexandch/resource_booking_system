import pool from "../config/db.js";

export async function getResources(req, res) {
    const data = await pool.query(`
        SELECT r.*, rt.name as type, b.name as building 
        FROM resources r
        JOIN resource_types rt ON r.type_id = rt.id
        JOIN buildings b ON r.building_id = b.id
    `);
    res.json(data.rows);
}

export async function getResourceById(req, res) {
    const id = req.params.id;

    const resource = await pool.query(`
        SELECT r.*, rt.name as type, b.name as building 
        FROM resources r
        JOIN resource_types rt ON r.type_id = rt.id
        JOIN buildings b ON r.building_id = b.id
        WHERE r.id = $1
    `, [id]);

    res.json(resource.rows[0]);
}
