import Log from '../models/Log.js';

export async function getLogs(req, res) {
  try {
    const {
      userId,
      action,
      level,
      startDate,
      endDate,
      page = 1,
      limit = 50,
      sort = 'desc'
    } = req.query;

    console.log('Received query params:', { userId, action, level, startDate, endDate, page, limit, sort });

    const filter = {};

    // Фильтр по userId (число)
    if (userId && userId !== '') {
      const parsedId = parseInt(userId);
      if (!isNaN(parsedId)) {
        filter.userId = parsedId;
      }
    }

    // Фильтр по action (строка)
    if (action && action !== '') {
      filter.action = action;
    }

    // Фильтр по level (строка)
    if (level && level !== '') {
      filter.level = level;
    }

    // Фильтр по датам
    if (startDate && startDate !== '') {
      const start = new Date(startDate);
      if (!isNaN(start)) {
        filter.timestamp = filter.timestamp || {};
        filter.timestamp.$gte = start;
      }
    }
    if (endDate && endDate !== '') {
      const end = new Date(endDate);
      if (!isNaN(end)) {
        filter.timestamp = filter.timestamp || {};
        filter.timestamp.$lte = end;
      }
    }

    console.log('MongoDB filter:', JSON.stringify(filter, null, 2));

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const sortOrder = sort === 'asc' ? 1 : -1;

    const logs = await Log.find(filter)
      .sort({ timestamp: sortOrder })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await Log.countDocuments(filter);

    res.json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ message: 'Ошибка при получении логов' });
  }
}