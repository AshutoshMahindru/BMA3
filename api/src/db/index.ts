import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

export const db = new Pool(
  connectionString
    ? {
        connectionString,
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5433', 10),
        database: process.env.DB_NAME || 'fpe_db',
        user: process.env.DB_USER || 'fpe_admin',
        password: process.env.DB_PASSWORD || 'fpe_password',
      },
);
