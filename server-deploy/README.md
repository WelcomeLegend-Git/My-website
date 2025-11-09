# JEE Study Companion Server

Simple Express.js server for the JEE Study Companion application.

## Endpoints

- `GET /` - Server info
- `GET /api/health` - Health check
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `ALL /trpc/*` - tRPC endpoints

## Deployment

This server is configured for Vercel deployment with serverless functions.
