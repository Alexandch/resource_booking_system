import express from 'express';
import auth from '../middleware/authMiddleware.js';
import {
  getBookingsPerDay,
  getActivityStats,
  getTopUsers,
  getActionDistribution,
  getTimeSeries,
  getAnomalies
} from '../controllers/analyticsController.js';

const router = express.Router();

router.get('/bookings-per-day', auth, getBookingsPerDay); // доступ, возможно, только для админов

router.get('/activity', getActivityStats);
router.get('/top-users', getTopUsers);
router.get('/actions', getActionDistribution);
router.get('/timeseries', getTimeSeries);
router.get('/anomalies', getAnomalies);

export default router;