import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function init() {
  console.log("Creating tables...");
  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      payment_method VARCHAR(50) NOT NULL,
      payment_day INTEGER NOT NULL,
      payments JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  console.log("Tables created successfully!");
  process.exit(0);
}

init().catch(console.error);
