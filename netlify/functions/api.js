import express from 'express';
import serverless from 'serverless-http';
import cors from 'cors';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();

app.use(cors());
app.use(express.json());

const getSql = () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing');
  return neon(process.env.DATABASE_URL);
};

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

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

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const sql = getSql();
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const result = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase()}`;
    if (result.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current user info
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const sql = getSql();
    const result = await sql`SELECT id, name, email FROM users WHERE id = ${req.userId}`;
    if (result.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Health Check ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', databaseConfigured: !!process.env.DATABASE_URL, timestamp: new Date().toISOString() });
});

// --- Client Routes (Protected) ---

// Get clients for the authenticated user
app.get('/api/clients', requireAuth, async (req, res) => {
  try {
    const sql = getSql();
    const clients = await sql`SELECT * FROM clients WHERE user_id = ${req.userId} ORDER BY created_at ASC`;
    const mapped = clients.map(c => ({
      id: c.id,
      name: c.name,
      paymentMethod: c.payment_method,
      paymentDay: c.payment_day,
      price: parseFloat(c.price || 0),
      payments: c.payments || {},
      createdAt: c.created_at
    }));
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add client
app.post('/api/clients', requireAuth, async (req, res) => {
  try {
    const sql = getSql();
    const { id, name, paymentMethod, paymentDay, price, payments } = req.body;
    const result = await sql`
      INSERT INTO clients (id, name, payment_method, payment_day, price, payments, user_id)
      VALUES (${id}, ${name}, ${paymentMethod}, ${paymentDay}, ${price || 0}, ${JSON.stringify(payments || {})}::jsonb, ${req.userId})
      RETURNING *
    `;
    const c = result[0];
    res.json({
      id: c.id, name: c.name,
      paymentMethod: c.payment_method,
      paymentDay: c.payment_day,
      price: parseFloat(c.price || 0),
      payments: c.payments,
      createdAt: c.created_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle payment
app.patch('/api/clients/:id/payment', requireAuth, async (req, res) => {
  try {
    const sql = getSql();
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
      UPDATE clients SET payments = ${JSON.stringify(payments)}::jsonb WHERE id = ${id} AND user_id = ${req.userId} RETURNING *
    `;
    const c = updated[0];
    res.json({
      id: c.id, name: c.name,
      paymentMethod: c.payment_method,
      paymentDay: c.payment_day,
      price: parseFloat(c.price || 0),
      payments: c.payments,
      createdAt: c.created_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset monthly payments
app.post('/api/clients/reset', requireAuth, async (req, res) => {
  try {
    const sql = getSql();
    const { monthKey } = req.body;
    await sql`UPDATE clients SET payments = payments - ${monthKey} WHERE user_id = ${req.userId}`;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete client
app.delete('/api/clients/:id', requireAuth, async (req, res) => {
  try {
    const sql = getSql();
    await sql`DELETE FROM clients WHERE id = ${req.params.id} AND user_id = ${req.userId}`;
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export const handler = serverless(app);
