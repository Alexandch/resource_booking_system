import connectMongo from './config/mongo.js';
import Log from './models/Log.js';

async function deleteTestLogs() {
    await connectMongo();
    const result = await Log.deleteMany({ action: "ANOMALY_TEST" });
    console.log(`Удалено ${result.deletedCount} записей`);
    process.exit(0);
}

deleteTestLogs();