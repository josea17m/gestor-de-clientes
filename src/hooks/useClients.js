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

export function useClients(isAuthenticated = false) {
  const [clients, setClients] = useState([]);

  useEffect(() => {
    if (!isAuthenticated) {
      setClients([]);
      return;
    }
    fetch('/api/clients', { headers: authHeaders() })
      .then(res => {
        if (!res.ok) throw new Error('Unauthorized');
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) setClients(data);
      })
      .catch(console.error);
  }, [isAuthenticated]);

  const addClient = async (client) => {
    const newClient = { ...client, id: crypto.randomUUID(), payments: {} };
    setClients(prev => [...prev, newClient]);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(newClient)
      });
      if (!res.ok) throw new Error('Failed to add');
      const saved = await res.json();
      // Replace the optimistic entry with the server response
      setClients(prev => prev.map(c => c.id === newClient.id ? saved : c));
    } catch (error) {
      console.error('Failed to add client:', error);
      // Rollback
      setClients(prev => prev.filter(c => c.id !== newClient.id));
    }
  };

  const removeClient = async (id) => {
    const snapshot = clients.find(c => c.id === id);
    setClients(prev => prev.filter(c => c.id !== id));
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (!res.ok) throw new Error('Failed to delete');
    } catch (error) {
      console.error('Failed to delete client:', error);
      // Rollback
      if (snapshot) setClients(prev => [...prev, snapshot].sort((a, b) => (a.paymentDay || 0) - (b.paymentDay || 0)));
    }
  };

  const togglePayment = async (clientId, monthKey) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const isPaid = !!client.payments?.[monthKey];
    const newIsPaid = !isPaid;

    // Optimistic update
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      const payments = { ...(c.payments || {}) };
      if (newIsPaid) {
        payments[monthKey] = true;
      } else {
        delete payments[monthKey];
      }
      return { ...c, payments };
    }));

    try {
      const res = await fetch(`/api/clients/${clientId}/payment`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ monthKey, isPaid: newIsPaid })
      });
      if (!res.ok) throw new Error('Failed to update payment');
    } catch (error) {
      console.error('Failed to update payment:', error);
      // Rollback to original state
      setClients(prev => prev.map(c => {
        if (c.id !== clientId) return c;
        const payments = { ...(c.payments || {}) };
        if (isPaid) {
          payments[monthKey] = true;
        } else {
          delete payments[monthKey];
        }
        return { ...c, payments };
      }));
    }
  };

  const resetPayments = async (monthKey) => {
    const snapshot = clients.map(c => ({ ...c, payments: { ...(c.payments || {}) } }));

    setClients(prev => prev.map(c => {
      const newPayments = { ...(c.payments || {}) };
      delete newPayments[monthKey];
      return { ...c, payments: newPayments };
    }));

    try {
      const res = await fetch('/api/clients/reset', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ monthKey })
      });
      if (!res.ok) throw new Error('Failed to reset payments');
    } catch (error) {
      console.error('Failed to reset payments:', error);
      // Rollback
      setClients(snapshot);
    }
  };

  return { clients, addClient, togglePayment, removeClient, resetPayments };
}
