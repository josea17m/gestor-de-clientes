import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL environment variable is required');
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

const JWT_SECRET = process.env.JWT_SECRET;
const sql = neon(process.env.DATABASE_URL);

app.use(cors());
app.use(express.json());

// --- Auth Middleware ---
const requireAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// --- Auth Routes ---

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const result = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase()}`;
    if (result.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const result = await sql`SELECT id, name, email FROM users WHERE id = ${req.userId}`;
    if (result.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result[0]);
  } catch (error) {
    console.error('Auth/me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Health Check ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Client Routes (Protected) ---

const mapClient = (c) => ({
  id: c.id,
  name: c.name,
  paymentMethod: c.payment_method,
  paymentDay: c.payment_day,
  price: parseFloat(c.price || 0),
  payments: c.payments || {},
  createdAt: c.created_at,
});

app.get('/api/clients', requireAuth, async (req, res) => {
  try {
    const clients = await sql`SELECT * FROM clients WHERE user_id = ${req.userId} ORDER BY created_at ASC`;
    res.json(clients.map(mapClient));
  } catch (error) {
    console.error('Fetch clients error:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

app.post('/api/clients', requireAuth, async (req, res) => {
  try {
    const { id, name, paymentMethod, paymentDay, price, payments } = req.body;
    const result = await sql`
      INSERT INTO clients (id, name, payment_method, payment_day, price, payments, user_id)
      VALUES (${id}, ${name}, ${paymentMethod}, ${paymentDay}, ${price || 0}, ${JSON.stringify(payments || {})}::jsonb, ${req.userId})
      RETURNING *
    `;
    res.json(mapClient(result[0]));
  } catch (error) {
    console.error('Add client error:', error);
    res.status(500).json({ error: 'Failed to add client' });
  }
});

app.patch('/api/clients/:id/payment', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { monthKey, isPaid } = req.body;

    const clientResult = await sql`SELECT payments FROM clients WHERE id = ${id} AND user_id = ${req.userId}`;
    if (clientResult.length === 0) return res.status(404).json({ error: 'Not found' });

    const payments = clientResult[0].payments || {};
    if (isPaid) {
      payments[monthKey] = true;
    } else {
      delete payments[monthKey];
    }

    const updated = await sql`
      UPDATE clients SET payments = ${JSON.stringify(payments)}::jsonb
      WHERE id = ${id} AND user_id = ${req.userId}
      RETURNING *
    `;
    res.json(mapClient(updated[0]));
  } catch (error) {
    console.error('Toggle payment error:', error);
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

app.post('/api/clients/reset', requireAuth, async (req, res) => {
  try {
    const { monthKey } = req.body;
    await sql`UPDATE clients SET payments = payments - ${monthKey} WHERE user_id = ${req.userId}`;
    res.json({ success: true });
  } catch (error) {
    console.error('Reset payments error:', error);
    res.status(500).json({ error: 'Failed to reset payments' });
  }
});

app.delete('/api/clients/:id', requireAuth, async (req, res) => {
  try {
    await sql`DELETE FROM clients WHERE id = ${req.params.id} AND user_id = ${req.userId}`;
    res.status(204).send();
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

app.listen(port, () => {
  console.log(`Dev server running on port ${port}`);
});
