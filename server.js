import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Neon connection
let sql;
try {
  if (process.env.DATABASE_URL) {
    sql = neon(process.env.DATABASE_URL);
    console.log('Neon database connection initialized.');
  } else {
    console.warn('WARNING: DATABASE_URL is not set in environment variables.');
  }
} catch (error) {
  console.error('Failed to initialize Neon connection:', error);
}

// API Routes

// Get all clients
app.get('/api/clients', async (req, res) => {
  try {
    if (!sql) return res.status(500).json({ error: 'Database not connected' });
    const clients = await sql`SELECT * FROM clients ORDER BY created_at ASC`;
    
    // Map database fields (snake_case) to frontend fields (camelCase)
    const mappedClients = clients.map(c => ({
      id: c.id,
      name: c.name,
      paymentMethod: c.payment_method,
      paymentDay: c.payment_day,
      payments: c.payments || {},
      createdAt: c.created_at
    }));

    res.json(mappedClients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// Add a new client
app.post('/api/clients', async (req, res) => {
  try {
    if (!sql) return res.status(500).json({ error: 'Database not connected' });
    const { id, name, paymentMethod, paymentDay, payments } = req.body;
    
    // We expect the frontend to pass the ID, but we can also let DB generate it.
    // For seamless migration, using frontend's UUID:
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
    res.status(500).json({ error: 'Failed to add client' });
  }
});

// Update a client's payment status for a specific month
app.patch('/api/clients/:id/payment', async (req, res) => {
  try {
    if (!sql) return res.status(500).json({ error: 'Database not connected' });
    const { id } = req.params;
    const { monthKey, isPaid } = req.body;

    // We can use jsonb_set to update the specific month key. 
    // In PostgreSQL jsonb_set: jsonb_set(target, path, new_value, create_missing)
    // The path is an array of text strings. For monthKey like '2026-04', it's ['2026-04']
    
    // Wait, manipulating jsonb dynamically with variables can be tricky.
    // An alternative is to fetch, manipulate, and update.
    const client = await sql`SELECT payments FROM clients WHERE id = ${id}`;
    if (client.length === 0) return res.status(404).json({ error: 'Client not found' });
    
    const payments = client[0].payments || {};
    if (isPaid) {
      payments[monthKey] = true;
    } else {
      delete payments[monthKey];
    }

    const updated = await sql`
      UPDATE clients 
      SET payments = ${payments}::jsonb
      WHERE id = ${id}
      RETURNING *
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
    console.error('Error updating payment:', error);
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

// Delete a client
app.delete('/api/clients/:id', async (req, res) => {
  try {
    if (!sql) return res.status(500).json({ error: 'Database not connected' });
    const { id } = req.params;
    await sql`DELETE FROM clients WHERE id = ${id}`;
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
