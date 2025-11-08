# ⚡ Quick Setup Reference

## 🔑 Your Credentials

### Gemini API Key:
```
AIzaSyB0yaE9pqcdhxb5ygQNETgzJNytqVnZxqE
```

---

## 📝 What You Need to Get from Supabase

Go to [https://app.supabase.com](https://app.supabase.com) and get these 4 things:

### 1. Database Connection String
**Location**: Project Settings → Database → Connection string (URI tab)
```
postgresql://postgres.[REF]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
```
⚠️ Replace `[PASSWORD]` with your actual password!

### 2. Project URL
**Location**: Project Settings → API → Project URL
```
https://[YOUR-PROJECT-REF].supabase.co
```

### 3. Anon Key (Public)
**Location**: Project Settings → API → Project API keys → anon/public
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Service Role Key (Secret)
**Location**: Project Settings → API → Project API keys → service_role
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🗂️ Storage Bucket Setup

1. Go to **Storage** → **Create bucket**
2. Name: `mistake-uploads`
3. Make it **Public** ✅
4. Add these policies:

**Upload Policy:**
```sql
CREATE POLICY "Allow authenticated users to upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'mistake-uploads');
```

**Read Policy:**
```sql
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'mistake-uploads');
```

---

## 📄 Environment Files

### `apps/server/.env`
```env
NODE_ENV=development
PORT=3001
DATABASE_URL="[PASTE CONNECTION STRING HERE]"
SUPABASE_URL="[PASTE PROJECT URL HERE]"
SUPABASE_SERVICE_ROLE_KEY="[PASTE SERVICE ROLE KEY HERE]"
JWT_ACCESS_SECRET="dev-access-secret-change-in-production-min-32-chars"
JWT_REFRESH_SECRET="dev-refresh-secret-change-in-production-min-32-chars"
GEMINI_API_KEYS="AIzaSyB0yaE9pqcdhxb5ygQNETgzJNytqVnZxqE"
UPLOAD_DIR="./uploads"
```

### `apps/web/.env`
```env
VITE_SUPABASE_URL="[PASTE PROJECT URL HERE]"
VITE_SUPABASE_ANON_KEY="[PASTE ANON KEY HERE]"
VITE_API_URL="http://localhost:3001"
```

---

## 🚀 Commands to Run

After setting up environment files:

```bash
# Generate Prisma client
cd apps/server
npx prisma generate

# Push schema to database
npx prisma db push

# Start backend
npm run dev

# In another terminal, start frontend
cd apps/web
npm run dev
```

---

## ✅ Quick Checklist

- [ ] Created Supabase project
- [ ] Got all 4 credentials
- [ ] Created `mistake-uploads` bucket (public)
- [ ] Added storage policies
- [ ] Updated `apps/server/.env`
- [ ] Created `apps/web/.env`
- [ ] Ran `npx prisma generate`
- [ ] Ran `npx prisma db push`
- [ ] Tested login/register

---

## 🆘 Common Issues

**"Invalid environment variables"**
→ Check that all values are filled in `.env` files

**"Can't reach database"**
→ Make sure you replaced `[PASSWORD]` in DATABASE_URL

**"Prisma error"**
→ Run `npx prisma generate` first

**"Storage upload fails"**
→ Check bucket is public and policies are added

---

**Need help?** Just ask me! 🤖
