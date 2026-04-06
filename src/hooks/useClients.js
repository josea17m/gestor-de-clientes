import { useState, useEffect } from 'react';

export function getCurrentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function useClients() {
  const [clients, setClients] = useState([]);

  useEffect(() => {
    fetch('/api/clients')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setClients(data);
        }
      })
      .catch(console.error);
  }, []);

  const addClient = async (client) => {
    const newClient = { ...client, id: crypto.randomUUID(), payments: {} };
    // Optimistic UI update
    setClients(prev => [...prev, newClient]);
    
    try {
      await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClient)
      });
    } catch (error) {
      console.error('Failed to add client:', error);
    }
  };

  const removeClient = async (id) => {
    // Optimistic UI update
    setClients(prev => prev.filter(c => c.id !== id));
    
    try {
      await fetch(`/api/clients/${id}`, { method: 'DELETE' });
    } catch (error) {
      console.error('Failed to delete client:', error);
    }
  };

  const togglePayment = async (clientId, monthKey) => {
    let newIsPaid = false;
    
    // Optimistic UI update
    setClients(prev => prev.map(c => {
      if (c.id === clientId) {
        const isPaid = c.payments ? !!c.payments[monthKey] : false;
        newIsPaid = !isPaid;
        return {
          ...c,
          payments: {
            ...(c.payments || {}),
            [monthKey]: newIsPaid
          }
        };
      }
      return c;
    }));

    try {
      await fetch(`/api/clients/${clientId}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthKey, isPaid: newIsPaid })
      });
    } catch (error) {
      console.error('Failed to update payment:', error);
    }
  };

  return { clients, addClient, togglePayment, removeClient };
}
