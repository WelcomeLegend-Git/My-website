# 🚀 JEE Study Companion - Deployment Guide

## ✅ Phase 1: COMPLETED
- [x] Created Vercel account
- [x] Created Supabase account  
- [x] Got Gemini API key: `AIzaSyB0yaE9pqcdhxb5ygQNETgzJNytqVnZxqE`
- [x] Installed Supabase dependencies
- [x] Migrated Prisma to PostgreSQL
- [x] Created Supabase client configuration

---

## 📋 Phase 2: YOUR TURN (10 minutes)

### Step 1: Create Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click **"New Project"**
3. Fill in the form:
   - **Organization**: Select your organization (or create one)
   - **Name**: `jee-study-companion`
   - **Database Password**: Create a strong password
     - **IMPORTANT**: Save this password! You'll need it later
     - Example: `MyStr0ngP@ssw0rd2024!`
   - **Region**: Select **Mumbai** or **Singapore** (closest to India)
   - **Pricing Plan**: **Free**
4. Click **"Create new project"**
5. ⏰ **Wait 2-3 minutes** for the project to provision

### Step 2: Get Database Connection String

Once your project is ready:

1. Go to **Project Settings** (gear icon in sidebar)
2. Click **Database** in the left menu
3. Scroll down to **Connection string**
4. Select the **URI** tab
5. Copy the connection string (it looks like this):
   ```
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
   ```
6. **Replace `[YOUR-PASSWORD]`** with your actual database password
7. **Save this connection string** - you'll need it in Step 4

### Step 3: Get API Keys

1. Still in **Project Settings**, click **API** in the left menu
2. Find the **Project API keys** section
3. Copy these TWO keys:
   
   **A. Project URL:**
   ```
   https://[YOUR-PROJECT-REF].supabase.co
   ```
   
   **B. anon / public key** (starts with `eyJ...`):
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
   
   **C. service_role / secret key** (starts with `eyJ...`):
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

4. **Save all three values** - you'll need them in Step 4

### Step 4: Enable Storage for File Uploads

1. Click **Storage** in the left sidebar
2. Click **"Create a new bucket"**
3. Fill in:
   - **Name**: `mistake-uploads`
   - **Public bucket**: Toggle **ON** ✅
   - **File size limit**: 50 MB (default is fine)
4. Click **"Create bucket"**
5. Click on the `mistake-uploads` bucket
6. Go to **Policies** tab
7. Click **"New Policy"** → **"For full customization"**
8. Add this policy for uploads:
   ```sql
   CREATE POLICY "Allow authenticated users to upload"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'mistake-uploads');
   ```
9. Add this policy for public access:
   ```sql
   CREATE POLICY "Allow public read access"
   ON storage.objects FOR SELECT
   TO public
   USING (bucket_id = 'mistake-uploads');
   ```

### Step 5: Update Your Local Environment Files

Now that you have all the credentials, let's set them up locally:

#### A. Update `apps/server/.env`:

```bash
NODE_ENV=development
PORT=3001
DATABASE_URL="[PASTE YOUR CONNECTION STRING FROM STEP 2]"
SUPABASE_URL="[PASTE YOUR PROJECT URL FROM STEP 3A]"
SUPABASE_SERVICE_ROLE_KEY="[PASTE YOUR SERVICE ROLE KEY FROM STEP 3C]"
JWT_ACCESS_SECRET="dev-access-secret-change-in-production-min-32-chars"
JWT_REFRESH_SECRET="dev-refresh-secret-change-in-production-min-32-chars"
GEMINI_API_KEYS="AIzaSyB0yaE9pqcdhxb5ygQNETgzJNytqVnZxqE"
UPLOAD_DIR="./uploads"
```

#### B. Create `apps/web/.env`:

```bash
VITE_SUPABASE_URL="[PASTE YOUR PROJECT URL FROM STEP 3A]"
VITE_SUPABASE_ANON_KEY="[PASTE YOUR ANON KEY FROM STEP 3B]"
VITE_API_URL="http://localhost:3001"
```

### Step 6: Run Database Migrations

Open a terminal and run:

```bash
cd apps/server
npx prisma generate
npx prisma db push
```

This will create all the tables in your Supabase database.

---

## ✅ Checklist - Did You Complete Everything?

Before moving to Phase 3, make sure you have:

- [ ] Created Supabase project
- [ ] Saved database password
- [ ] Copied database connection string
- [ ] Copied Project URL
- [ ] Copied anon/public key
- [ ] Copied service_role/secret key
- [ ] Created `mistake-uploads` bucket
- [ ] Set bucket to public
- [ ] Added storage policies
- [ ] Updated `apps/server/.env` with all values
- [ ] Created `apps/web/.env` with all values
- [ ] Ran `npx prisma generate`
- [ ] Ran `npx prisma db push` successfully

---

## 🎯 What's Next?

Once you complete Phase 2, tell me **"Phase 2 done"** and I'll:

1. Update the auth system to use Supabase Auth
2. Migrate file uploads to Supabase Storage
3. Create Vercel deployment configuration
4. Help you deploy to production

---

## 🆘 Troubleshooting

### "Can't reach database server"
- Make sure you replaced `[YOUR-PASSWORD]` in the connection string
- Check that your Supabase project is fully provisioned (green status)

### "Invalid API key"
- Make sure you copied the full key (they're very long!)
- Check for extra spaces at the beginning or end

### "Prisma migration failed"
- Make sure DATABASE_URL is correct in `.env`
- Try `npx prisma generate` first, then `npx prisma db push`

### Need Help?
Just ask me! I'm here to help you through every step.

---

## 📊 Progress Tracker

| Phase | Status | Time |
|-------|--------|------|
| Phase 1: Accounts & API Keys | ✅ Done | 5 mins |
| Phase 2: Supabase Setup | 🔄 In Progress | 10 mins |
| Phase 3: Code Migration | ⏳ Waiting | 30 mins |
| Phase 4: Deployment | ⏳ Waiting | 20 mins |
| Phase 5: Testing | ⏳ Waiting | 15 mins |

**Total Time to Production**: ~80 minutes
**Time Remaining**: ~75 minutes

Let's do this! 🚀
