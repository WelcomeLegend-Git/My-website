# Admin Monitoring & User Management Guide

This guide shows you how to monitor your JEE Study Companion app, check database usage, and manage users.

---

## 🎯 Quick Access

- **Supabase Dashboard**: https://supabase.com/dashboard
- **Vercel Dashboard**: https://vercel.com/dashboard

---

## 📊 Supabase Free Tier Limits

Your current plan includes:

- **Database**: 500MB storage
- **Storage (files)**: 1GB
- **Bandwidth**: 2GB/month  
- **API Requests**: 50,000/month
- **Concurrent connections**: 60

⚠️ **Monitor these limits** - you'll get notifications when nearing capacity.

---

## 🔍 Where to Monitor Usage

### 1. Supabase Dashboard → Settings → Usage

Shows real-time metrics:
- Database size (MB used out of 500MB)
- Storage size (file uploads)
- Bandwidth consumption
- API request count
- Active connections

### 2. Database Table Browser

**Path**: Supabase Dashboard → Table Editor

Tables to monitor:
- `User` - all registered users
- `Formula` - formulas per user
- `Mistake` - mistakes logged per user
- `QuizSession` - quiz attempts
- `FormulaCollection` - collections created
- `PracticeQuiz` - practice quizzes

### 3. Storage Browser

**Path**: Supabase Dashboard → Storage → `mistake-uploads`

- View all uploaded images/files
- See file sizes
- Delete files manually if needed

---

## 📈 Useful SQL Queries

Run these in **Supabase Dashboard → SQL Editor**

### See All Users with Their Activity

```sql
SELECT 
  u.id,
  u.email,
  u.name,
  u."createdAt" as joined_date,
  COUNT(DISTINCT f.id) as formula_count,
  COUNT(DISTINCT m.id) as mistake_count,
  COUNT(DISTINCT qs.id) as quiz_sessions,
  COUNT(DISTINCT fc.id) as collections,
  COUNT(DISTINCT pq.id) as practice_quizzes
FROM "User" u
LEFT JOIN "Formula" f ON f."ownerId" = u.id
LEFT JOIN "Mistake" m ON m."ownerId" = u.id
LEFT JOIN "QuizSession" qs ON qs."userId" = u.id
LEFT JOIN "FormulaCollection" fc ON fc."ownerId" = u.id
LEFT JOIN "PracticeQuiz" pq ON pq."userId" = u.id
GROUP BY u.id, u.email, u.name, u."createdAt"
ORDER BY u."createdAt" DESC;
```

### Get Total Database Usage Statistics

```sql
SELECT 
  (SELECT COUNT(*) FROM "User") as total_users,
  (SELECT COUNT(*) FROM "Formula") as total_formulas,
  (SELECT COUNT(*) FROM "Mistake") as total_mistakes,
  (SELECT COUNT(*) FROM "QuizSession") as total_quiz_sessions,
  (SELECT COUNT(*) FROM "FormulaCollection") as total_collections,
  (SELECT COUNT(*) FROM "PracticeQuiz") as total_practice_quizzes;
```

### Find Most Active Users (by quiz count)

```sql
SELECT 
  u.email,
  u.name,
  COUNT(qs.id) as quiz_count,
  COUNT(DISTINCT qs."quizId") as unique_quizzes
FROM "User" u
LEFT JOIN "QuizSession" qs ON qs."userId" = u.id
GROUP BY u.id, u.email, u.name
HAVING COUNT(qs.id) > 0
ORDER BY quiz_count DESC
LIMIT 10;
```

### Check Recent Signups (last 7 days)

```sql
SELECT 
  email,
  name,
  "createdAt" as signup_date
FROM "User"
WHERE "createdAt" >= NOW() - INTERVAL '7 days'
ORDER BY "createdAt" DESC;
```

### Get Storage Usage Per User (uploaded files)

Note: This requires checking the `MistakeAsset` table if you have it, or querying Storage metadata.

```sql
-- Check mistake uploads
SELECT 
  u.email,
  COUNT(ma.id) as uploaded_files
FROM "User" u
LEFT JOIN "Mistake" m ON m."ownerId" = u.id
LEFT JOIN "MistakeAsset" ma ON ma."mistakeId" = m.id
WHERE ma.kind = 'image'
GROUP BY u.id, u.email
ORDER BY uploaded_files DESC;
```

---

## 🗑️ Delete User and All Their Data

### Option 1: Via Supabase Dashboard

1. Go to **Table Editor → User**
2. Find the user by email
3. Click the row → **Delete**
4. Confirm deletion

✅ **Cascading deletes are configured** - this will automatically delete:
- All formulas
- All mistakes  
- All quiz sessions
- All collections
- All practice quizzes
- All related assets

### Option 2: Via SQL

```sql
-- Delete by email
DELETE FROM "User" 
WHERE email = 'user@example.com';

-- Delete by ID
DELETE FROM "User" 
WHERE id = 'user-uuid-here';
```

⚠️ **Warning**: This is permanent and cannot be undone!

---

## 🔐 AI Access Management

### Set Your Access Code

In **Vercel Dashboard** → Your Project → Settings → Environment Variables:

```
AI_ACCESS_CODE=your-secret-code-here
```

Make it:
- At least 6 characters
- Hard to guess
- Memorable for you to share with friends

### Share with Friends

When someone asks for access:

1. Give them your secret `AI_ACCESS_CODE`
2. They open the AI Mentor sidebar
3. They enter the code once
4. Access is saved to their browser (localStorage)
5. They won't be asked again on that device

### Revoke All Access

To revoke everyone's access:

1. Change `AI_ACCESS_CODE` in Vercel
2. Redeploy your app
3. All users must re-verify with the new code

### Monitor AI Usage (Gemini API)

- Check your Google AI Studio dashboard for API usage
- Set up billing alerts if needed
- Rotate `GEMINI_API_KEYS` if you detect abuse

---

## 💾 Backup & Export Data

### Export User Data

```sql
-- Export all user formulas as CSV
COPY (
  SELECT 
    u.email,
    f.title,
    f.expression,
    f.explanation,
    s.name as subject,
    c.title as chapter
  FROM "Formula" f
  JOIN "User" u ON f."ownerId" = u.id
  JOIN "Subject" s ON f."subjectId" = s.id
  JOIN "Chapter" c ON f."chapterId" = c.id
) TO '/tmp/formulas_export.csv' CSV HEADER;
```

Or use Supabase's built-in export:
- Table Editor → Select table → Export as CSV

---

## 🚨 Alerts & Notifications

### Set Up Database Alerts

In Supabase, you can create database functions that trigger on events:

1. **New User Signup Alert**
2. **Database Size Threshold**
3. **Unusual Activity Detection**

Contact Supabase support or use webhooks for advanced monitoring.

---

## 📞 Emergency Actions

### If Database Fills Up (500MB limit)

1. **Delete old quiz sessions**:
```sql
DELETE FROM "QuizSession" 
WHERE "completedAt" < NOW() - INTERVAL '90 days';
```

2. **Archive old mistakes**:
```sql
DELETE FROM "Mistake" 
WHERE "status" = 'resolved' 
AND "updatedAt" < NOW() - INTERVAL '180 days';
```

3. **Clean up orphaned data**:
```sql
-- Find users with no activity
SELECT u.email 
FROM "User" u
LEFT JOIN "Formula" f ON f."ownerId" = u.id
LEFT JOIN "Mistake" m ON m."ownerId" = u.id
WHERE f.id IS NULL AND m.id IS NULL;
```

### If Storage Fills Up (1GB limit)

1. Go to **Storage → mistake-uploads**
2. Sort by size
3. Delete large/old files manually
4. Or use SQL to find and remove:

```sql
-- This requires custom storage function or Supabase API
```

---

## 🎓 Best Practices

1. **Check usage weekly** - set a calendar reminder
2. **Keep backups** - export critical data monthly
3. **Rotate AI access codes** - change every 3-6 months
4. **Monitor new signups** - make sure they're people you know
5. **Set Vercel alerts** - for function invocations and bandwidth
6. **Document changes** - keep a log of who you gave access to

---

## 📋 Monthly Checklist

- [ ] Check Supabase usage dashboard
- [ ] Review new user signups
- [ ] Verify database size is under 400MB
- [ ] Check Gemini API usage in Google AI Studio
- [ ] Export backup of critical data
- [ ] Review Vercel function logs for errors
- [ ] Update AI_ACCESS_CODE if needed

---

## 🆘 Support & Resources

- **Supabase Docs**: https://supabase.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **Prisma Docs**: https://www.prisma.io/docs
- **This Repo Issues**: Create an issue if you find bugs

---

## 🔗 Quick Links Summary

| Resource | URL |
|----------|-----|
| Supabase Dashboard | https://supabase.com/dashboard |
| Vercel Dashboard | https://vercel.com/dashboard |
| Google AI Studio | https://aistudio.google.com |
| Database SQL Editor | Supabase → SQL Editor |
| Storage Browser | Supabase → Storage → mistake-uploads |
| Env Variables | Vercel → Project → Settings → Environment Variables |

---

**Last Updated**: November 2025  
**Maintainer**: Suraj (Project Owner)
