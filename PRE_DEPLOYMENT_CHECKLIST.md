# 🚀 Pre-Deployment Checklist

Complete these steps **before deploying to Vercel**.

---

## ✅ Step 1: Set Up Supabase

### 1.1 Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click **New Project**
3. Choose a name (e.g., "jee-companion")
4. Set a strong database password
5. Select a region close to you (e.g., Mumbai for India)
6. Wait for project to provision (~2 minutes)

### 1.2 Get Your Credentials

Once ready, go to **Settings → API**:

- ✅ **Project URL**: `https://xxxxx.supabase.co` → Save as `SUPABASE_URL`
- ✅ **anon/public key**: `eyJhbGc...` → Save as `SUPABASE_ANON_KEY`  
- ✅ **service_role key**: `eyJhbGc...` → Save as `SUPABASE_SERVICE_ROLE_KEY`

⚠️ **Keep service_role key secret!**

### 1.3 Get Database Connection String

Go to **Settings → Database**:

- ✅ **Connection string (Pooler)**: `postgresql://...` → Save as `DATABASE_URL`
- ✅ **Direct connection**: `postgresql://...` → Save as `DIRECT_DATABASE_URL` (optional)

**Important**: Use the **Transaction** pooler mode for Prisma.

### 1.4 Create Storage Bucket

Go to **Storage**:

1. Click **New Bucket**
2. Name: `mistake-uploads`
3. Set as **Public bucket** (enable public URLs)
4. Click **Create Bucket**

---

## ✅ Step 2: Prepare Environment Variables

Create a secure file to store these temporarily (delete after deployment):

### Server Environment Variables (Vercel)

```bash
# Database
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

# Supabase
SUPABASE_URL="https://xxxxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGc..."

# JWT Secrets (generate random 32+ character strings)
JWT_ACCESS_SECRET="generate-random-32-char-string-here-abc123"
JWT_REFRESH_SECRET="generate-random-32-char-string-here-xyz789"

# Gemini AI
GEMINI_API_KEYS="your-gemini-key-1,your-gemini-key-2"
GEMINI_MODEL_PRIMARY="gemini-2.0-flash-exp"
GEMINI_MODEL_FALLBACK="gemini-1.5-flash,gemini-1.5-pro"

# AI Access Protection (your secret code for friends)
AI_ACCESS_CODE="MySecretCode2024"
```

### Web Environment Variables (Vercel)

```bash
# API
VITE_API_URL="https://your-app-name.vercel.app"

# Supabase (for web client)
VITE_SUPABASE_URL="https://xxxxx.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGc..."
```

### How to Generate JWT Secrets

**Option 1 - Using Node.js**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option 2 - Online Generator**:
- https://generate-secret.vercel.app/32

---

## ✅ Step 3: Run Database Migrations

### 3.1 Set Local Environment

Create `apps/server/.env`:

```bash
DATABASE_URL="your-supabase-connection-string"
# ... other vars from above
```

### 3.2 Run Migrations

```bash
cd apps/server
npm install
npx prisma migrate deploy
npx prisma generate
```

### 3.3 (Optional) Seed Initial Data

```bash
npx prisma db seed
```

This creates sample subjects/chapters.

---

## ✅ Step 4: Deploy to Vercel

### 4.1 Install Vercel CLI

```bash
npm install -g vercel
```

### 4.2 Login to Vercel

```bash
vercel login
```

### 4.3 Set Environment Variables in Vercel

**Option A - Via Vercel Dashboard**:

1. Go to https://vercel.com/dashboard
2. Select your project (or create new)
3. Go to **Settings → Environment Variables**
4. Add all server + web env vars from Step 2
5. Select **Production**, **Preview**, and **Development**

**Option B - Via CLI**:

```bash
vercel env add DATABASE_URL production
# Paste value, press Enter
# Repeat for all variables
```

### 4.4 Deploy

```bash
# From project root
vercel --prod
```

Or use GitHub Actions (already configured):
```bash
git add .
git commit -m "feat: add AI access verification"
git push origin master
```

---

## ✅ Step 5: Verify Deployment

### 5.1 Check Health Endpoint

Visit: `https://your-app.vercel.app/api/health`

Should return:
```json
{
  "status": "ok",
  "env": {
    "hasDatabase": true,
    "hasSupabase": true,
    "hasGemini": true
  }
}
```

### 5.2 Test User Registration

1. Open `https://your-app.vercel.app`
2. Click **Sign Up**
3. Register a test account
4. Verify you can log in

### 5.3 Test AI Mentor Access

1. Log in
2. Go to any page with AI Sidebar
3. **Verification modal should appear**
4. Enter your `AI_ACCESS_CODE`
5. Verify AI chat works

### 5.4 Test File Upload

1. Create a mistake
2. Upload an image
3. Verify it appears in Supabase Storage → `mistake-uploads`

---

## ✅ Step 6: Post-Deployment Tasks

### 6.1 Update VITE_API_URL

After first deploy, update web env:

```bash
# In Vercel Dashboard → Settings → Environment Variables
VITE_API_URL="https://your-actual-domain.vercel.app"
```

Then redeploy.

### 6.2 Set Up Custom Domain (Optional)

1. Vercel Dashboard → Settings → Domains
2. Add your domain
3. Update DNS records as instructed

### 6.3 Enable Analytics (Optional)

Vercel Dashboard → Analytics → Enable

---

## 🔐 Security Checklist

- [ ] Database password is strong (20+ characters)
- [ ] JWT secrets are random and 32+ characters
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is only in Vercel (never in frontend)
- [ ] `AI_ACCESS_CODE` is hard to guess
- [ ] Supabase RLS policies are enabled (check Database → Policies)
- [ ] Storage bucket `mistake-uploads` allows public reads only

---

## 🧪 Testing Checklist

- [ ] User registration works
- [ ] User login works
- [ ] Formula CRUD works
- [ ] Mistake logging works
- [ ] Image upload works
- [ ] AI Mentor requires verification code
- [ ] AI chat responds correctly
- [ ] Quiz generation works
- [ ] LaTeX renders properly
- [ ] Mobile responsive

---

## 📞 Troubleshooting

### "Invalid environment variables" error

- Check all env vars are set in Vercel
- Verify no extra spaces in values
- Rebuild and redeploy

### Database connection errors

- Verify `DATABASE_URL` uses **Transaction** pooler (port 6543)
- Check Supabase project is not paused (free tier auto-pauses after 1 week inactivity)
- Run `npx prisma migrate deploy` again

### AI Mentor not working

- Verify `GEMINI_API_KEYS` is set
- Check Google AI Studio for API quota
- Verify `AI_ACCESS_CODE` is at least 6 characters

### File uploads fail

- Verify `mistake-uploads` bucket exists
- Check bucket is set to **public**
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct

### tRPC type errors in development

- Run `npm run build` in `apps/server` to regenerate types
- Restart your dev server

---

## 🎉 You're Ready!

Once all checks pass:

1. ✅ Share `AI_ACCESS_CODE` with trusted friends
2. ✅ Monitor usage via `ADMIN_MONITORING_GUIDE.md`
3. ✅ Set up weekly backup routine
4. ✅ Enjoy your personal JEE Study Companion!

---

**Need Help?**

- Check `ADMIN_MONITORING_GUIDE.md` for usage monitoring
- Review Vercel function logs for errors
- Check Supabase logs in Dashboard → Logs
