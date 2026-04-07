import { useState, useEffect } from 'react';

const TOKEN_KEY = 'mamiapp_token';

export function getCurrentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`
  };
}

export function useClients() {
  const [clients, setClients] = useState([]);

  useEffect(() => {
    fetch('/api/clients', { headers: authHeaders() })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setClients(data);
      })
      .catch(console.error);
  }, []);

  const addClient = async (client) => {
    const newClient = { ...client, id: crypto.randomUUID(), payments: {} };
    setClients(prev => [...prev, newClient]);
    try {
      await fetch('/api/clients', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(newClient)
      });
    } catch (error) {
      console.error('Failed to add client:', error);
    }
  };

  const removeClient = async (id) => {
    setClients(prev => prev.filter(c => c.id !== id));
    try {
      await fetch(`/api/clients/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
    } catch (error) {
      console.error('Failed to delete client:', error);
    }
  };

  const togglePayment = async (clientId, monthKey) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const isPaid = client.payments ? !!client.payments[monthKey] : false;
    const newIsPaid = !isPaid;

    setClients(prev => prev.map(c => {
      if (c.id === clientId) {
        return {
          ...c,
          payments: { ...(c.payments || {}), [monthKey]: newIsPaid }
        };
      }
      return c;
    }));

    try {
      await fetch(`/api/clients/${clientId}/payment`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ monthKey, isPaid: newIsPaid })
      });
    } catch (error) {
      console.error('Failed to update payment:', error);
    }
  };

  const resetPayments = async (monthKey) => {
    setClients(prev => prev.map(c => {
      const newPayments = { ...(c.payments || {}) };
      delete newPayments[monthKey];
      return { ...c, payments: newPayments };
    }));
    try {
      await fetch('/api/clients/reset', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ monthKey })
      });
    } catch (error) {
      console.error('Failed to reset payments:', error);
    }
  };

  return { clients, addClient, togglePayment, removeClient, resetPayments };
}
