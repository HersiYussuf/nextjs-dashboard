// lib/db.ts

const { createClient } = require('@vercel/postgres');

const client = createClient({
  connectionString: process.env.VITE_POSTGRES_URL,
});

client.connect().catch(err => {
  console.error('Failed to connect to the database:', err);
});

module.exports = client;