import express from 'express';
import serverless from 'serverless-http';
import cors from 'cors';
import { neon } from '@neondatabase/serverless';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Helper for DB connection (lazy initialization)
const getSql = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is missing in Netlify settings.');
  }
  return neon(process.env.DATABASE_URL);
};

// API Routes

// Health check (Diagnostic)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    databaseConfigured: !!process.env.DATABASE_URL,
    timestamp: new Date().toISOString()
  });
});

// Get all clients
app.get('/api/clients', async (req, res) => {
  try {
    const sql = getSql();
    const clients = await sql`SELECT * FROM clients ORDER BY created_at ASC`;
    const mapped = clients.map(c => ({
      id: c.id,
      name: c.name,
      paymentMethod: c.payment_method || c.paymentMethod,
      paymentDay: c.payment_day || c.paymentDay,
      payments: c.payments || {},
      createdAt: c.created_at
    }));
    res.json(mapped);
  } catch (error) {
    console.error('API Error (GET /api/clients):', error.message);
    res.status(500).json({ 
      error: 'Backend Error', 
      message: error.message,
      suggestion: 'Check your Netlify Environment Variables for DATABASE_URL'
    });
  }
});

// Add client
app.post('/api/clients', async (req, res) => {
  try {
    const sql = getSql();
    const { id, name, paymentMethod, paymentDay, payments } = req.body;
    const newClient = await sql`
      INSERT INTO clients (id, name, payment_method, payment_day, payments)
      VALUES (${id}, ${name}, ${paymentMethod}, ${paymentDay}, ${payments || {}}::jsonb)
      RETURNING *
    `;
    const mapped = {
      id: newClient[0].id,
      name: newClient[0].name,
      paymentMethod: newClient[0].payment_method,
      paymentDay: newClient[0].payment_day,
      payments: newClient[0].payments,
      createdAt: newClient[0].created_at
    };
    res.json(mapped);
  } catch (error) {
    console.error('API Error (POST /api/clients):', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Toggle payment
app.patch('/api/clients/:id/payment', async (req, res) => {
  try {
    const sql = getSql();
    const { id } = req.params;
    const { monthKey, isPaid } = req.body;
    
    const clientResult = await sql`SELECT payments FROM clients WHERE id = ${id}`;
    if (clientResult.length === 0) return res.status(404).json({ error: 'Not found' });
    
    const payments = clientResult[0].payments || {};
    if (isPaid) {
      payments[monthKey] = true;
    } else {
      delete payments[monthKey];
    }
    
    const updated = await sql`
      UPDATE clients SET payments = ${payments}::jsonb WHERE id = ${id} RETURNING *
    `;
    
    const mapped = {
      id: updated[0].id,
      name: updated[0].name,
      paymentMethod: updated[0].payment_method,
      paymentDay: updated[0].payment_day,
      payments: updated[0].payments,
      createdAt: updated[0].created_at
    };
    
    res.json(mapped);
  } catch (error) {
    console.error('API Error (PATCH /api/payment):', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Delete client
app.delete('/api/clients/:id', async (req, res) => {
  try {
    const sql = getSql();
    const { id } = req.params;
    await sql`DELETE FROM clients WHERE id = ${id}`;
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export const handler = serverless(app);
