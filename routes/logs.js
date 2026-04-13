import express from 'express';
import auth from '../middleware/authMiddleware.js';
import checkRole from '../middleware/roleMiddleware.js';
import { getLogs } from '../controllers/logController.js';

const router = express.Router();

router.get('/', auth, checkRole([1]), getLogs);

export default router;