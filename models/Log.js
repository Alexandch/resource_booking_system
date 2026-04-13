import mongoose from 'mongoose';

const logSchema = new mongoose.Schema({
  userId: { type: Number, index: true }, // ID пользователя из PostgreSQL
  action: { type: String, required: true, index: true }, // Тип события: 'LOGIN', 'LOGOUT', 'CREATE_USER', 'UPDATE_RESOURCE', 'DELETE_USER', 'ERROR' и т.д.
  description: { type: String }, // Детальное описание
  metadata: { type: mongoose.Schema.Types.Mixed }, // Дополнительные данные (например, тело запроса, IP, user-agent)
  level: { type: String, default: 'info', enum: ['info', 'warn', 'error'] }, // Уровень важности
  timestamp: { type: Date, default: Date.now, index: true }
});

// TTL индекс для автоматического удаления старых записей
logSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 }); // 30 дней = 30*24*60*60

const Log = mongoose.model('Log', logSchema);

export default Log;