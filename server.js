import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

import authRoutes from "./routes/auth.js";
import resourcesRoutes from "./routes/resources.js";
import reservationsRoutes from "./routes/reservations.js";
import adminRoutes from "./routes/admin.js";
import notificationsRoutes from "./routes/notifications.js";
import analyticsRoutes from './routes/analytics.js';
import Logger from './services/logger.js';
import logsRoutes from './routes/logs.js';

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// маршруты
app.use("/api/auth", authRoutes);
app.use("/api/resources", resourcesRoutes);
app.use("/api/reservations", reservationsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use((err, req, res, next) => {
  // Логируем ошибку в MongoDB
  Logger.error({
    userId: req.user?.id,
    action: 'SERVER_ERROR',
    description: err.message,
    metadata: {
      url: req.originalUrl,
      method: req.method,
      body: req.body,
      params: req.params,
      query: req.query,
      ip: req.ip
    },
    error: err
  });

  console.error(err.stack);
  res.status(500).json({ message: 'Внутренняя ошибка сервера' });
});
app.use('/api/logs', logsRoutes);

app.listen(3000, () => {
    console.log("Server running on port 3000");
});
