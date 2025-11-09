# Vercel Monorepo Deployment Fix Guide

## Problem
You have a monorepo with 2 Vercel projects (web + server), but they're not configured to build from the correct subdirectories.

## Solution: Configure Both Vercel Projects Properly

### Project 1: jee-studycompanion-web (Frontend)

1. Go to Vercel Dashboard → **jee-studycompanion-web** project
2. Click **Settings** → **General**
3. Scroll to **"Root Directory"**
4. Set Root Directory to: `apps/web`
5. Click **Save**

6. Scroll to **"Build & Development Settings"**
7. **Framework Preset**: Vite
8. **Build Command**: `npm run build`
9. **Output Directory**: `dist`
10. **Install Command**: `cd ../.. && npm install`
11. Click **Save**

12. Go to **Settings** → **Git**
13. Verify **Production Branch** is set to: `master`
14. Click **Save**

### Project 2: jee-studycompanion-server (Backend)

1. Go to Vercel Dashboard → **jee-studycompanion-server** project
2. Click **Settings** → **General**
3. Scroll to **"Root Directory"**
4. Set Root Directory to: `apps/server`
5. Click **Save**

6. Scroll to **"Build & Development Settings"**
7. **Framework Preset**: Other
8. **Build Command**: Leave empty (serverless functions don't need build)
9. **Output Directory**: Leave empty
10. **Install Command**: `cd ../.. && npm install`
11. Click **Save**

12. Go to **Settings** → **Git**
13. Verify **Production Branch** is set to: `master`
14. Click **Save**

## After Configuration

1. Go to **Deployments** tab on **jee-studycompanion-web**
2. Click the **three dots (•••)** on the latest deployment
3. Click **"Redeploy"**
4. **UNCHECK** "Use existing Build Cache"
5. Click **"Redeploy"**

## Your Premium UI Will Then Be Live!

The deployment will pull commit `999719b` which contains:
- ✨ GlowSelect component with glassmorphism
- 🎨 Custom animations (fadeIn, shimmer, gradientShift)
- 📱 Responsive design
- 💫 Premium styling throughout

## Future Deployments

Once configured, every push to `master` branch will automatically deploy both projects.
