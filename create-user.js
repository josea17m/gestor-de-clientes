import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

// Usage: node create-user.js "Your Name" "email@example.com" "yourpassword"
const [,, name, email, password] = process.argv;

if (!name || !email || !password) {
  console.error('Usage: node create-user.js "Full Name" "email@example.com" "password"');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function createUser() {
  const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (existing.length > 0) {
    console.error(`❌ A user with email "${email}" already exists.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await sql`
    INSERT INTO users (name, email, password_hash)
    VALUES (${name}, ${email}, ${passwordHash})
    RETURNING id, name, email, created_at
  `;

  const user = result[0];
  console.log('✅ User created successfully!');
  console.log(`   Name:  ${user.name}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   ID:    ${user.id}`);
  process.exit(0);
}

createUser().catch(err => {
  console.error('Failed to create user:', err.message);
  process.exit(1);
});
