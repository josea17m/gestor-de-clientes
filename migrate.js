import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is required in .env");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log("Checking schema for 'price' column...");
  
  try {
    // Add price column if it doesn't exist
    await sql`
      ALTER TABLE clients 
      ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2) DEFAULT 0;
    `;
    console.log("Migration successful: 'price' column added (or already exists).");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

migrate();
