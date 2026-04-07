import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

const sql = neon(process.env.DATABASE_URL);

async function init() {
  console.log('Creating tables...');

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      payment_method VARCHAR(50) NOT NULL,
      payment_day INTEGER NOT NULL,
      price NUMERIC(10, 2) NOT NULL DEFAULT 0,
      payments JSONB DEFAULT '{}'::jsonb,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS clients_user_id_idx ON clients(user_id);`;

  console.log('Tables created successfully!');
  process.exit(0);
}

init().catch(err => {
  console.error(err);
  process.exit(1);
});
