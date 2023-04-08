const express = require("express");
const axios = require('axios');
const schedule = require('node-schedule');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3001;
const TELEGRAM_BOT_TOKEN = '6202001281:AAEkc3Zo2yRauBgJm6QlS-HDhnbnFafZszI';
const NEWS_API_KEY = '4d547f2d7ef549c9bb849833e790d744';

app.use(express.json());
app.use(express.text());
app.use(cors());

const getRandomIndex = (arr) => {
  // get random index value
  return Math.floor(Math.random() * arr.length);
}


const fetchNews = async () => {
  const { data } = await axios.get('https://newsapi.org/v2/everything', {
    params: {
      q: 'finance OR crypto',
      language: 'en',
      apiKey: NEWS_API_KEY,
    },
  });

  // Extract the latest news headline and URL
  const latestNews = data.articles[getRandomIndex(data.articles)];
  const newsMessage = `*Latest Finance News:*\n\n${latestNews.title}\n${latestNews.url}`;

  return newsMessage;
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Schedule a daily task to fetch the latest finance news
schedule.scheduleJob('0 9 * * *', async () => {
  try {
    // Fetch finance news from API
    const newsMessage = await fetchNews();

    // Send news to group
    bot.sendMessage('YOUR_GROUP_CHAT_ID', newsMessage, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Failed to fetch finance news:', err);
  }
});

// Handle /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Hello! I'm Shibtalik. Use /news to get the latest finance news, Use /help to see the list of available commands..");
});

// Handle /news command
bot.onText(/\/news/, async (msg) => {
  try {
    // Fetch finance news from API
    const newsMessage = await fetchNews();

    // Send news to user
    bot.sendMessage(msg.chat.id, newsMessage, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Failed to fetch finance news:', err);
    bot.sendMessage(msg.chat.id, 'Failed to fetch finance news.');
  }
});

// Handle /alert command
bot.onText(/\/alert (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const contractAddress = match[1];

  // Save contract address to database or file
  // ...

  bot.sendMessage(chatId, `You will now receive price alerts for ${contractAddress}.`);
});

bot.onText(/\/help/, (msg) => {
  
  const helpText = `
  Available commands:
  /start - Introduce myself
  /news - Get the latest finance news
  /alert - Manage your price alerts
  /help - User manual
  `;
  bot.sendMessage(msg.chat.id, helpText);
});


// Handle custom alerts from group admin
bot.on('message', async (msg) => {

  console.log('new message: ', msg);

  try {
    // Check if message is from group chat and sent by group admin
    if (msg.chat.type === 'group' && msg.from.id === 714295076) {
      const chatId = msg.chat.id;
      const alertMessage = msg.text;

      // Send alert message to group members
      bot.sendMessage(chatId, alertMessage);
    }
  } catch (err) {
    console.error('Failed to handle custom alert:', err);
  }
});


app.get("/", async (req, res) => res.send("Hello, I'm Shibtalik, a Telegram bot"));

app.listen(port, () => console.log(`Bot listening at http://0.0.0.0:${port}`));
