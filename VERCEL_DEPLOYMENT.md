# 🚀 Vercel Deployment Guide

## ✅ What's Been Completed

- [x] PostgreSQL database setup (Supabase)
- [x] Database migrations completed
- [x] File uploads migrated to Supabase Storage
- [x] Environment files configured
- [x] Vercel configuration created

---

## 📦 Deploy to Vercel (5 minutes)

### Step 1: Install Vercel CLI (if not already)

```bash
npm install -g vercel
vercel login
```

### Step 2: Deploy Frontend

```bash
cd apps/web
vercel
```

**Follow the prompts:**
- Link to existing project? **No**
- Project name: `jee-study-companion-web` (or your choice)
- Which directory? **./apps/web**
- Want to modify settings? **No**

### Step 3: Add Frontend Environment Variables

After deployment, go to your Vercel dashboard:

1. Select your project
2. Go to **Settings** → **Environment Variables**
3. Add these variables:

```
VITE_SUPABASE_URL=https://mgehxznfluazziszbqsj.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nZWh4em5mbHVhenppc3picXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0NzM1NTcsImV4cCI6MjA3ODA0OTU1N30.mWB28Wy5ksk-4L3MEF4E94c95LIynsH2ydGRfJ_9GYU
VITE_API_URL=https://your-backend-url.vercel.app
```

⚠️ **Note**: You'll update `VITE_API_URL` after deploying the backend

### Step 4: Deploy Backend

```bash
cd ../server
vercel
```

**Follow the prompts:**
- Link to existing project? **No**
- Project name: `jee-study-companion-api` (or your choice)
- Which directory? **./apps/server**
- Want to modify settings? **No**

### Step 5: Add Backend Environment Variables

In Vercel dashboard for your backend project:

1. Go to **Settings** → **Environment Variables**
2. Add these variables:

```
NODE_ENV=production
DATABASE_URL=postgresql://postgres.mgehxznfluazziszbqsj:8rj4oiSoFPVnafg2@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://mgehxznfluazziszbqsj.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nZWh4em5mbHVhenppc3picXNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjQ3MzU1NywiZXhwIjoyMDc4MDQ5NTU3fQ.1HAOW6XocYnJIuuaraVSCwL279if3LeT7ajDzu_S7IQ
JWT_ACCESS_SECRET=production-access-secret-min-32-characters-change-this
JWT_REFRESH_SECRET=production-refresh-secret-min-32-characters-change-this
GEMINI_API_KEYS=AIzaSyB0yaE9pqcdhxb5ygQNETgzJNytqVnZxqE
```

### Step 6: Update Frontend API URL

1. Copy your backend Vercel URL (e.g., `https://jee-study-companion-api.vercel.app`)
2. Go to your **frontend** project in Vercel
3. **Settings** → **Environment Variables**
4. Update `VITE_API_URL` to your backend URL
5. Go to **Deployments** → Click **"Redeploy"** on the latest deployment

### Step 7: Configure CORS

Update your backend to allow your frontend domain:

In `apps/server/src/app.ts`, update the CORS config:

```typescript
app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'https://your-frontend-url.vercel.app'
    ],
    credentials: true,
  })
);
```

Then redeploy the backend.

---

## 🎯 Alternative: Single Deployment

If you want to deploy both frontend and backend together:

### Option 1: Monorepo Deployment

```bash
# From project root
vercel
```

This will deploy both apps together using the root `vercel.json` configuration.

### Option 2: Use Vercel's Monorepo Support

1. Link your GitHub repository to Vercel
2. Vercel will auto-detect the monorepo structure
3. Configure build settings:
   - **Root Directory**: `apps/web`
   - **Build Command**: `cd ../.. && npm run build --workspace=@jee/web`
   - **Output Directory**: `apps/web/dist`

---

## 🔒 Security Checklist

Before going live:

- [ ] Change JWT secrets to strong random strings (32+ characters)
- [ ] Never commit `.env` files to Git
- [ ] Enable Supabase Row Level Security (RLS)
- [ ] Set up proper CORS origins
- [ ] Enable rate limiting on API routes
- [ ] Review Supabase storage bucket policies

---

## 🧪 Testing Your Deployment

After deployment:

1. **Test Registration**: Create a new account
2. **Test Login**: Sign in with your account
3. **Test Mistake Log**: Create a mistake with photo upload
4. **Test AI Analysis**: Try the AI analyze feature
5. **Test Formulas**: Add and search formulas

---

## 📊 Monitoring

### Vercel Dashboard
- View deployment logs
- Monitor function execution time
- Check bandwidth usage

### Supabase Dashboard
- Monitor database queries
- Check storage usage
- View API request logs

---

## 🆘 Troubleshooting

### "Cannot connect to database"
→ Check DATABASE_URL in Vercel environment variables

### "CORS error"
→ Add your Vercel frontend URL to CORS origins in backend

### "File upload fails"
→ Verify Supabase storage bucket is public and has correct policies

### "Build fails"
→ Check build logs in Vercel dashboard
→ Ensure all dependencies are in package.json

---

## 🎉 You're Live!

Your app is now deployed at:
- **Frontend**: `https://your-project.vercel.app`
- **Backend**: `https://your-api.vercel.app`

Share it with your friends and start studying! 🚀📚
