import express from 'express';
import serverless from 'serverless-http';
import cors from 'cors';
import { neon } from '@neondatabase/serverless';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Neon connection
const sql = neon(process.env.DATABASE_URL);

// API Routes

// Get all clients
app.get('/api/clients', async (req, res) => {
  try {
    const clients = await sql`SELECT * FROM clients ORDER BY created_at ASC`;
    const mapped = clients.map(c => ({
      id: c.id,
      name: c.name,
      paymentMethod: c.payment_method,
      paymentDay: c.payment_day,
      payments: c.payments || {},
      createdAt: c.created_at
    }));
    res.json(mapped);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

// Add client
app.post('/api/clients', async (req, res) => {
  try {
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
    console.error('Error adding client:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

// Toggle payment
app.patch('/api/clients/:id/payment', async (req, res) => {
  try {
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
    console.error('Error updating:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

// Delete client
app.delete('/api/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await sql`DELETE FROM clients WHERE id = ${id}`;
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

export const handler = serverless(app);
