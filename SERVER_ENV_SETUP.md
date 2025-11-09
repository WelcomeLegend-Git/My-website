# Server Environment Variables Setup

## Required Environment Variables for Vercel

Add these in **Vercel Dashboard → jee-study-companion-server → Settings → Environment Variables**:

### 1. DATABASE_URL
```
DATABASE_URL
```
**Value:** Your Supabase PostgreSQL connection string
**Format:** `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

### 2. SUPABASE_URL  
```
SUPABASE_URL
```
**Value:** Your Supabase project URL
**Format:** `https://[PROJECT-REF].supabase.co`

### 3. SUPABASE_SERVICE_ROLE_KEY
```
SUPABASE_SERVICE_ROLE_KEY
```
**Value:** Your Supabase service role key (from Supabase Dashboard → Settings → API)

### 4. JWT_ACCESS_SECRET
```
JWT_ACCESS_SECRET
```
**Value:** A strong 32+ character secret for JWT tokens
**Example:** `your-super-secret-jwt-access-key-here-32-chars-min`

### 5. JWT_REFRESH_SECRET
```
JWT_REFRESH_SECRET
```
**Value:** Another strong 32+ character secret for refresh tokens
**Example:** `your-super-secret-jwt-refresh-key-here-32-chars-min`

### 6. GEMINI_API_KEYS
```
GEMINI_API_KEYS
```
**Value:** Your Google Gemini API key(s) (comma-separated if multiple)
**Format:** `AIzaSyC...your-key-here` or `key1,key2,key3`

### 7. NODE_ENV (Optional)
```
NODE_ENV
```
**Value:** `production`

## After Adding Variables

1. **Save all environment variables**
2. **Go to Deployments tab**
3. **Click "Redeploy" on latest deployment** (or push new commit)
4. **Server will be live at:** `https://jee-study-companion-server.vercel.app`

## Frontend Connection

✅ **Already Updated:** Frontend now points to deployed server URL
✅ **Ready to Deploy:** Updated frontend will connect to server automatically

## Test Server

Once deployed with env vars, test:
- `https://jee-study-companion-server.vercel.app/api/health` (should return health status)
- `https://jee-study-companion-server.vercel.app/trpc` (should return tRPC info)
