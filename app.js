const express = require("express");
const axios = require('axios');
const schedule = require('node-schedule');
const TelegramBot = require('node-telegram-bot-api');
const cors = require('cors');
// const { Client } = require('pg');

const app = express();
const port = process.env.PORT || 3001;
const TELEGRAM_BOT_TOKEN = '6202001281:AAFj7Hj3d4wbRbtGrDpPlzDbZSg05zjexcQ';
const NEWS_API_KEY = '4d547f2d7ef549c9bb849833e790d744';

app.use(express.json());
app.use(express.text());
app.use(cors());

// const pgClient = new Client({
//   connectionString: 'postgres://shibtalik_postgres:uVwWIbH5UKw0nbHBuKFUlqSdR5l6Mq6w@dpg-cgpsa2u4dad9donh89mg-a/shibtalik_postgres',
//   ssl: {
//     rejectUnauthorized: false
//   }
// });

// Establishing connection to PostgreSQL database
// pgClient.connect(err => {
//   if (err) {
//     console.error('Error connecting to PostgreSQL database: ', err.stack);
//   } else {
//     console.log('Connected to PostgreSQL database');
//   }
// });

// Function to save contract address for daily alerts to PostgreSQL database
const saveContractAddress = async (chatId, contractAddress) => {
  // const query = {
  //   text: 'INSERT INTO daily_alerts(chat_id, contract_address) VALUES($1, $2) ON CONFLICT DO NOTHING',
  //   values: [chatId, contractAddress],
  // };

  // try {
  //   await pgClient.query(query);
  //   console.log(`Contract address ${contractAddress} saved for chat ${chatId}`);
  // } catch (err) {
  //   console.error(`Error saving contract address ${contractAddress} for chat ${chatId} to PostgreSQL database: `, err.stack);
  // }
}

// Function to retrieve contract addresses for daily alerts from PostgreSQL database
const getContractAddresses = async (chatId) => {
  // const query = {
  //   text: 'SELECT contract_address, chat_id FROM daily_alerts WHERE chat_id = $1',
  //   values: [chatId],
  // };

  // try {
  //   const result = await pgClient.query(query);
  //   return result.rows.map(row => row.contract_address);
  // } catch (err) {
  //   console.error(`Error retrieving contract addresses for chat ${chatId} from PostgreSQL database: `, err.stack);
  //   return [];
  // }

  return [];
}

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

// Use a cryptocurrency price API to get the current price of the contract.
const fetchContractPrice = async (address) => {
  const url = `https://api.coingecko.com/api/v3/coins/ethereum/contract/${address}`;
  const response = await axios.get(url);

  if (response.data.error) {
    throw new Error(response.data.error);
  }

  const str = `
    *Name*: ${String(response.data.name)}
    *Symbol*: ${String(response.data.symbol).toUpperCase()}
    *Network*: ${String(response.data.asset_platform_id).toUpperCase()}
    *Price*: $${response.data.market_data.current_price.usd}
    *Total volume*: $${response.data.market_data.total_volume.usd}
    *24h high*: $${response.data.market_data.low_24h.usd}
    *24h low*: $${response.data.market_data.high_24h.usd}
    *24h price change*: ${response.data.market_data.price_change_24h} : $${response.data.market_data.price_change_24h_in_currency.usd}
    *Total supply*: $${response.data.market_data.total_supply}
    *Max supply*: $${response.data.market_data.max_supply}
    *CoinGecko rank*: ${response.data.coingecko_rank}
  `;

  return str;
};

/**
 * @type {TelegramBot?} TelegramBot?
 */
let bot;


const runTelegramBot = async () => {

  try {
    // parent failsafe

    console.log('Before initializing bot');
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
    console.log('After initializing bot');

    /**
     * List of IDs fo rgroups teh bot has been added to 
     */
    const groupChatIDs = [];

    // Schedule a daily task to fetch the latest finance news, 9AM daill
    const scheduledJob = schedule.scheduleJob('0 9 * * *', async () => {
      try {
        // Fetch finance news from API
        const newsMessage = await fetchNews();

        // Send news to groups
        groupChatIDs.forEach(async (groupChatID) => {
          bot.sendMessage(groupChatID, newsMessage, { parse_mode: 'Markdown' });

          const savedAddresses = await getContractAddresses(groupChatID);
          savedAddresses.forEach(async (address) => {
            try {
              const currentPrice = await fetchContractPrice(address.contract_address);
              bot.sendMessage(
                chatId, `
            *Current price for ${contractAddress}*:
            ${currentPrice}.
            `,
                { parse_mode: 'Markdown' }
              );
            } catch (error) {
              console.error(error);
              bot.sendMessage(chatId, `Error while retrieving price for ${address.contract_address}, ${error.message}.`);
            }
          });
        });

      } catch (err) {
        console.error('Failed to run schedule:', err);
      }
    });

    // failsafe
    try {

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
      bot.onText(/\/alert (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const contractAddress = match[1];

        if (contractAddress) {

          bot.sendMessage(chatId, `You will now receive price alerts for ${contractAddress}.`);

          try {
            const currentPrice = await fetchContractPrice(contractAddress);
            bot.sendMessage(
              chatId,
              `
            *Current price for ${contractAddress}*:
            ${currentPrice}.
            `,
              { parse_mode: 'Markdown' }
            );

            // Save contract address to database or file
            await saveContractAddress(chatId, contractAddress);
          } catch (error) {
            console.error(error.message);
            bot.sendMessage(chatId, `Error while retrieving price for ${contractAddress}, ${error.message}.`);
          }

          return;
        }

        bot.sendMessage(chatId, `Try again with a valid contract address`);

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

        try {

          const chatId = msg.chat.id;

          // // Check if message is from group chat and sent by group admin
          // if (msg.chat.type === 'group' && msg.from.id === 714295076) {
          //   const alertMessage = msg.text;

          //   // Send alert message to group members
          //   bot.sendMessage(chatId, alertMessage);
          // }

          if (msg && msg.chat.type === 'group') {
            console.log(`Bot added to group ${msg.chat.title}, chat ID: ${msg.chat.id}`);
            groupChatIDs.push(msg.chat.id);
          }

          // Get chat administrators
          const chatAdministrators = await bot.getChatAdministrators(chatId);
          // Filter out non-administrators
          const groupAdmins = chatAdministrators.filter(admin => admin.status === 'creator' || admin.status === 'administrator');
          // Check if message is from group chat and sent by group admin
          if (msg.chat.type === 'group' && groupAdmins.some(admin => admin.user.id === msg.from.id)) {
            // Send alert message to group members
            bot.sendMessage(chatId, msg.text);
          }

        } catch (err) {
          console.error('Failed to handle custom alert:', err);
        }
      });

      // restart the bot every 10 minuts
      setInterval(async () => {
        scheduledJob.cancel();
        bot.removeAllListeners();
        await bot.stopPolling({ cancel: true, reason: 'failsafe' });
        await bot.close();
        return await runTelegramBot();
      }, 1000 * 60 * 10);

    } catch (error) {
      // failsafe catch block

      console.error(error);

      // relaunch bot in 3 seconds
      setTimeout(async () => {
        scheduledJob.cancel();
        bot.removeAllListeners();
        await bot.stopPolling({ cancel: true, reason: 'failsafe' });
        await bot.close();
        return await runTelegramBot();
      }, 1000 * 3);

    }
  } catch (error) {
    // parent failsafe catch block

    console.error('Fatal crash occurred');

    return setTimeout(() => {
      return runTelegramBot();
    }, 1000 * 3);
  }

}


app.get("/", async (_, res) => res.send("Hello, I'm Shibtalik, a Telegram bot"));

app.listen(port, () => {
  runTelegramBot();

  console.clear();
  console.log(`Bot listening at http://0.0.0.0:${port}`)
});