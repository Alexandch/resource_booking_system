import pool from '../config/db.js';
import { getCache, setCache, delCache } from '../services/cacheService.js';
import Log from '../models/Log.js';      
import { Parser } from 'json2csv';

// Вспомогательная функция для экспорта в CSV
const exportToCSV = (res, data, filename) => {
  const json2csvParser = new Parser();
  const csv = json2csvParser.parse(data);
  res.header('Content-Type', 'text/csv');
  res.attachment(filename);
  res.send(csv);
};

export async function getBookingsPerDay(req, res) {
  const cacheKey = 'cache:analytics:bookings_per_day';
  const cached = await getCache(cacheKey);
  if (cached) return res.json(cached);

  const result = await pool.query(`
    SELECT DATE(created_at) as day, COUNT(*) as count
    FROM bookings
    GROUP BY day
    ORDER BY day DESC
  `);

  await setCache(cacheKey, result.rows, 1800); // 30 минут
  res.json(result.rows);
}

// === 1. Статистика активности пользователей по периодам ===
export async function getActivityStats(req, res) {
  try {
    const { period = 'day', startDate, endDate, format } = req.query;

    const match = {};
    if (startDate || endDate) {
      match.timestamp = {};
      if (startDate) match.timestamp.$gte = new Date(startDate);
      if (endDate) match.timestamp.$lte = new Date(endDate);
    }

    let dateFormat;
    if (period === 'day') dateFormat = '%Y-%m-%d';
    else if (period === 'week') dateFormat = '%Y-%U';
    else if (period === 'month') dateFormat = '%Y-%m';
    else dateFormat = '%Y-%m-%d';

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$timestamp' } },
          totalEvents: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          period: '$_id',
          totalEvents: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          _id: 0
        }
      },
      { $sort: { period: 1 } }
    ];

    const stats = await Log.aggregate(pipeline);

    if (format === 'csv') {
      return exportToCSV(res, stats, `activity_${period}_${Date.now()}.csv`);
    }
    res.json(stats);
  } catch (error) {
    console.error('Error in getActivityStats:', error);
    res.status(500).json({ message: 'Ошибка при получении статистики активности' });
  }
}

// === 2. ТОП-10 самых активных пользователей ===
export async function getTopUsers(req, res) {
  try {
    const { limit = 10, startDate, endDate, format } = req.query;

    const match = {};
    if (startDate || endDate) {
      match.timestamp = {};
      if (startDate) match.timestamp.$gte = new Date(startDate);
      if (endDate) match.timestamp.$lte = new Date(endDate);
    }

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: '$userId',
          eventCount: { $sum: 1 },
          lastEvent: { $max: '$timestamp' },
          actions: { $addToSet: '$action' }
        }
      },
      { $sort: { eventCount: -1 } },
      { $limit: parseInt(limit) },
      {
        $project: {
          userId: '$_id',
          eventCount: 1,
          lastEvent: 1,
          actions: 1,
          _id: 0
        }
      }
    ];

    const topUsers = await Log.aggregate(pipeline);

    if (format === 'csv') {
      return exportToCSV(res, topUsers, `top_users_${Date.now()}.csv`);
    }
    res.json(topUsers);
  } catch (error) {
    console.error('Error in getTopUsers:', error);
    res.status(500).json({ message: 'Ошибка при получении топа пользователей' });
  }
}

// === 3. Распределение операций по типам (CRUD-статистика) ===
export async function getActionDistribution(req, res) {
  try {
    const { startDate, endDate, format } = req.query;

    const match = {};
    if (startDate || endDate) {
      match.timestamp = {};
      if (startDate) match.timestamp.$gte = new Date(startDate);
      if (endDate) match.timestamp.$lte = new Date(endDate);
    }

    const pipeline = [
      { $match: match },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { action: '$_id', count: 1, _id: 0 } }
    ];

    const distribution = await Log.aggregate(pipeline);

    if (format === 'csv') {
      return exportToCSV(res, distribution, `action_distribution_${Date.now()}.csv`);
    }
    res.json(distribution);
  } catch (error) {
    console.error('Error in getActionDistribution:', error);
    res.status(500).json({ message: 'Ошибка при получении распределения действий' });
  }
}

// === 4. Временные тренды (time series analysis) ===
export async function getTimeSeries(req, res) {
  try {
    const { interval = 'hour', startDate, endDate, format } = req.query;

    const match = {};
    if (startDate || endDate) {
      match.timestamp = {};
      if (startDate) match.timestamp.$gte = new Date(startDate);
      if (endDate) match.timestamp.$lte = new Date(endDate);
    }

    let dateFormat;
    if (interval === 'hour') dateFormat = '%Y-%m-%d %H:00';
    else if (interval === 'day') dateFormat = '%Y-%m-%d';
    else if (interval === 'week') dateFormat = '%Y-%U';
    else dateFormat = '%Y-%m-%d %H:00';

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: {
            timeSlot: { $dateToString: { format: dateFormat, date: '$timestamp' } },
            action: '$action'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.timeSlot',
          actions: { $push: { action: '$_id.action', count: '$count' } },
          total: { $sum: '$count' }
        }
      },
      { $sort: { '_id': 1 } },
      { $project: { timeSlot: '$_id', total: 1, actions: 1, _id: 0 } }
    ];

    const series = await Log.aggregate(pipeline);

    if (format === 'csv') {
      // Для CSV преобразуем в плоскую структуру
      const flat = series.flatMap(s => s.actions.map(a => ({
        timeSlot: s.timeSlot,
        action: a.action,
        count: a.count
      })));
      return exportToCSV(res, flat, `timeseries_${interval}_${Date.now()}.csv`);
    }
    res.json(series);
  } catch (error) {
    console.error('Error in getTimeSeries:', error);
    res.status(500).json({ message: 'Ошибка при получении временных рядов' });
  }
}

// === 5. Аномалии в поведении пользователей ===
export async function getAnomalies(req, res) {
  try {
    const { threshold = 100, startDate, endDate, format } = req.query;

    const match = {};
    if (startDate || endDate) {
      match.timestamp = {};
      if (startDate) match.timestamp.$gte = new Date(startDate);
      if (endDate) match.timestamp.$lte = new Date(endDate);
    }

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: {
            userId: '$userId',
            hour: { $hour: '$timestamp' },
            day: { $dayOfYear: '$timestamp' },
            year: { $year: '$timestamp' }
          },
          count: { $sum: 1 },
          events: { $push: { action: '$action', time: '$timestamp' } }
        }
      },
      { $match: { count: { $gt: parseInt(threshold) } } },
      { $sort: { count: -1 } },
      {
        $project: {
          userId: '$_id.userId',
          period: {
            hour: '$_id.hour',
            day: '$_id.day',
            year: '$_id.year'
          },
          eventCount: '$count',
          events: 1,
          _id: 0
        }
      }
    ];

    const anomalies = await Log.aggregate(pipeline);

    if (format === 'csv') {
      const flat = anomalies.map(a => ({
        userId: a.userId,
        hour: a.period.hour,
        day: a.period.day,
        year: a.period.year,
        eventCount: a.eventCount
      }));
      return exportToCSV(res, flat, `anomalies_${Date.now()}.csv`);
    }
    res.json(anomalies);
  } catch (error) {
    console.error('Error in getAnomalies:', error);
    res.status(500).json({ message: 'Ошибка при поиске аномалий' });
  }
}