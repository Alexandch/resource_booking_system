import Log from '../models/Log.js';

class Logger {
  /**
   * Запись информационного события
   * @param {Object} params
   * @param {number} params.userId - ID пользователя (если есть)
   * @param {string} params.action - Тип действия
   * @param {string} params.description - Описание
   * @param {Object} params.metadata - Доп. данные
   */
  static async info({ userId, action, description, metadata = {} }) {
    try {
      const log = new Log({
        userId,
        action,
        description,
        metadata,
        level: 'info',
        timestamp: new Date()
      });
      await log.save();
    } catch (err) {
      console.error('Failed to save log to MongoDB:', err);
    }
  }

  /**
   * Запись ошибки
   * @param {Object} params
   * @param {number} params.userId
   * @param {string} params.action
   * @param {string} params.description
   * @param {Object} params.metadata
   * @param {Error} params.error - объект ошибки
   */
  static async error({ userId, action, description, metadata = {}, error }) {
    try {
      const log = new Log({
        userId,
        action,
        description,
        metadata: {
          ...metadata,
          errorMessage: error?.message,
          stack: error?.stack
        },
        level: 'error',
        timestamp: new Date()
      });
      await log.save();
    } catch (err) {
      console.error('Failed to save error log to MongoDB:', err);
    }
  }
}

export default Logger;