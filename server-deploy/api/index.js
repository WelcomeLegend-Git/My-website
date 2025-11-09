// Serverless function entry point for Vercel
const express = require('express');
const cors = require('cors');
const { createExpressMiddleware } = require('@trpc/server/adapters/express');

// Import environment configuration
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'JEE Study Companion Server is running!',
    timestamp: new Date().toISOString(),
    env: {
      hasDatabase: !!process.env.DATABASE_URL,
      hasSupabase: !!process.env.SUPABASE_URL,
      hasGemini: !!process.env.GEMINI_API_KEYS,
    }
  });
});

// Placeholder for tRPC - will be replaced with actual implementation
app.all('/trpc/*', (req, res) => {
  res.status(501).json({ 
    error: 'tRPC endpoints not yet configured',
    message: 'Backend is running but tRPC router needs to be compiled'
  });
});

// Default route
app.get('/', (req, res) => {
  res.json({ 
    message: 'JEE Study Companion API Server',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      trpc: '/trpc/*'
    }
  });
});

// Export for Vercel serverless
module.exports = app;
