const { Client } = require('pg');
const client = new Client({
  connectionString: 'your-postgres-database-url',
  ssl: {
    rejectUnauthorized: false
  }
});

// Establishing connection to PostgreSQL database
client.connect(err => {
  if (err) {
    console.error('Error connecting to PostgreSQL database: ', err.stack);
  } else {
    console.log('Connected to PostgreSQL database');
  }
});

// Function to save contract address for daily alerts to PostgreSQL database
async function saveContractAddress(chatId, contractAddress) {
  const query = {
    text: 'INSERT INTO daily_alerts(chat_id, contract_address) VALUES($1, $2) ON CONFLICT DO NOTHING',
    values: [chatId, contractAddress],
  };

  try {
    await client.query(query);
    console.log(`Contract address ${contractAddress} saved for chat ${chatId}`);
  } catch (err) {
    console.error(`Error saving contract address ${contractAddress} for chat ${chatId} to PostgreSQL database: `, err.stack);
  }
}

// Function to retrieve contract addresses for daily alerts from PostgreSQL database
async function getContractAddresses(chatId) {
  const query = {
    text: 'SELECT contract_address FROM daily_alerts WHERE chat_id = $1',
    values: [chatId],
  };

  try {
    const result = await client.query(query);
    return result.rows.map(row => row.contract_address);
  } catch (err) {
    console.error(`Error retrieving contract addresses for chat ${chatId} from PostgreSQL database: `, err.stack);
    return [];
  }
}
