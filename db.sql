-- Run this block in your Neon Database SQL Editor

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  payment_day INTEGER NOT NULL,
  payments JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
