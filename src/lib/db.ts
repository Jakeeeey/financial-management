import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.APP_DB_HOST || '100.85.114.17',
  port: Number(process.env.APP_DB_PORT || 3307),
  database: process.env.APP_DB_NAME || 'vos_database',
  user: process.env.APP_DB_USER || 'vosSystem',
  password: process.env.APP_DB_PASS || 'X7#mK9$vP2!qL5z',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

export default pool;
