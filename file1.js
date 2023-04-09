const axios = require('axios');
const cron = require('node-cron');
const { MongoClient } = require('mongodb');
const Telegraf = require('telegraf');

// Parse the user's command to extract the contract address.
const getContractAddress = (text) => {
    const match = text.match(/^\/alert\s+([a-fA-F0-9]{40})$/);
    return match ? match[1].toLowerCase() : null;
};

// Use a cryptocurrency price API to get the current price of the contract.
const getPrice = async (address) => {
    const url = `https://api.coingecko.com/api/v3/coins/ethereum/contract/${address}`;
    const response = await axios.get(url);
    return response.data.market_data.current_price.usd;
};

// Store the user's alert preferences in a database.
const saveAlert = async (db, chatId, address, threshold) => {
    const collection = db.collection('alerts');
    const result = await collection.updateOne(
        { chatId, address },
        { $set: { chatId, address, threshold } },
        { upsert: true }
    );
    return result.modifiedCount || result.upsertedCount;
};

// Set up a cron job to check the contract price at regular intervals.
const startAlerts = (bot, db) => {
    cron.schedule('* * * * *', async () => {
        const alerts = await db.collection('alerts').find().toArray();
        for (const alert of alerts) {
            const price = await getPrice(alert.address);
            if (price >= alert.threshold && alert.previousPrice < alert.threshold) {
                bot.telegram.sendMessage(alert.chatId, `Alert: ${alert.address} has reached ${price}`);
            }
            await db.collection('alerts').updateOne({ _id: alert._id }, { $set: { previousPrice: price } });
        }
    });
};

// Set up the Telegram bot.
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Connect to the database and start the alerts.
MongoClient.connect(process.env.MONGODB_URI, (err, client) => {
    if (err) {
        console.error(err);
        return;
    }
    const db = client.db();
    startAlerts(bot, db);
});

// Handle the /alert command.
bot.command('alert', async (ctx) => {
    const chatId = ctx.chat.id;
    const address = getContractAddress(ctx.message.text);
    if (!address) {
        ctx.reply('Invalid command. Usage: /alert {contract address}');
        return;
    }
    const threshold = 100; // Example threshold
    await saveAlert(db, chatId, address, threshold);
    ctx.reply(`Alert set for ${address} at ${threshold}`);
});

// Start the bot.
bot.startPolling();
