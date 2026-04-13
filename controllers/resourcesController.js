import pool from "../config/db.js";
import { getCache, setCache, delCache } from '../services/cacheService.js';

export async function getResources(req, res) {
    const cacheKey = 'cache:resources:list';

    const cached = await getCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await pool.query(`
        SELECT r.*, rt.name as type, b.name as building 
        FROM resources r
        JOIN resource_types rt ON r.type_id = rt.id
        JOIN buildings b ON r.building_id = b.id
    `);

    await setCache(cacheKey, data.rows, 300);
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
