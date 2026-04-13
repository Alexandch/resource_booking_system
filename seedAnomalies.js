import connectMongo from './config/mongo.js';
import Log from './models/Log.js';

async function seedAnomaly() {
    await connectMongo();
    const userId = 1; 
    const now = new Date();
    const logs = [];
    for (let i = 0; i < 150; i++) {
        logs.push({
            userId,
            action: "LOGIN",
            description: "Аномальная активность",
            level: "info",
            timestamp: new Date(now.getTime() - i * 1000)
        });
    }
    await Log.insertMany(logs);
    console.log(`✅ Добавлено ${logs.length} записей для аномалии (userId=${userId})`);
    process.exit(0);
}

seedAnomaly();