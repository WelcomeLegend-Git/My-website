// Simple Node.js server for Vercel
const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'JEE Study Companion Server is running!',
    timestamp: new Date().toISOString()
  });
});

// Basic auth endpoints (mock for now)
app.post('/api/auth/login', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Login successful',
    user: { id: 1, email: 'test@example.com' }
  });
});

app.post('/api/auth/register', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Registration successful'
  });
});

// tRPC endpoint placeholder
app.all('/trpc/*', (req, res) => {
  res.json({ 
    message: 'tRPC endpoint ready',
    path: req.path 
  });
});

// Default route
app.get('/', (req, res) => {
  res.json({ 
    message: 'JEE Study Companion API Server',
    endpoints: ['/api/health', '/api/auth/login', '/api/auth/register', '/trpc/*']
  });
});

// Export for Vercel
module.exports = app;
