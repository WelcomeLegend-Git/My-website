# 🔧 QUIZ GENERATION DEBUG & FIX GUIDE

## ✅ **FIXES APPLIED:**

### **1. Backend Error Handling - IMPROVED**
- ✅ Added detailed error logging
- ✅ Added API key validation
- ✅ Improved context handling (handles missing formulas)
- ✅ Better error messages (shows actual error instead of generic)

### **2. Practice Button - FIXED**
- ✅ Now triggers form submission properly
- ✅ Increased timeout for AI sidebar to load (500ms)
- ✅ Dispatches submit event after setting input value

---

## 🧪 **TESTING STEPS:**

### **Step 1: Restart Server**
```bash
cd apps/server
npm run dev
```

**Watch for logs:**
```
Quiz generation started: { user: '...', config: 'mains', ... }
Generated prompt length: ...
Gemini response received, length: ...
```

### **Step 2: Check Server Logs**

If you see **"Gemini API key not configured"**:
```bash
# Check .env file in apps/server
cat apps/server/.env | grep GEMINI_API_KEY
```

If missing or empty:
```bash
# Add to apps/server/.env
GEMINI_API_KEY=your_actual_key_here
```

### **Step 3: Test Practice Button**
1. Refresh browser (Ctrl + Shift + R)
2. Go to `/formulas`
3. Click any collection
4. **Click green "Practice Quiz" button**
5. **Watch:**
   - AI sidebar should open
   - Message "I want to practice these formulas" should appear
   - Quiz config form should appear

### **Step 4: Test Quiz Generation**
1. Configure quiz settings
2. Click "Generate Quiz"
3. **Check server terminal for logs:**

**Success logs:**
```
Quiz generation started: { ... }
Generated prompt length: 1234
Gemini response received, length: 5678
```

**Error logs:**
```
Quiz generation error: [ERROR MESSAGE HERE]
```

---

## 🐛 **COMMON ERRORS & FIXES:**

### **Error: "Gemini API key not configured"**
**Fix:**
```bash
cd apps/server
echo "GEMINI_API_KEY=your_key_here" >> .env
npm run dev
```

### **Error: "Failed to parse generated questions"**
**Cause:** Gemini returned invalid JSON

**Fix:** Check server logs for actual Gemini response
```javascript
// The response is logged as:
console.log('Gemini response received, length:', response.length);
```

### **Error: "Cannot read property 'formulas' of undefined"**
**Fix:** ✅ ALREADY FIXED - Now handles missing context gracefully

### **Practice Button doesn't trigger**
**Check:**
1. Is AI sidebar visible?
2. Does textarea appear after 500ms?
3. Check browser console for errors

**Manual Test:**
```javascript
// Open browser console
const aiInput = document.querySelector('textarea[placeholder="Ask the mentor anything..."]');
console.log('AI Input found:', !!aiInput);
```

---

## 📊 **IMPROVED CONTEXT HANDLING:**

### **Before:**
```javascript
const formulaInfo = context?.formulas?.map(...).join("\n") || "";
// If formulas undefined → empty string → bad prompt
```

### **After:**
```javascript
// 1. Try to get formulas
if (context?.formulas && Array.isArray(context.formulas)) {
  formulaInfo = context.formulas.map(...).join("\n");
}

// 2. Fallback to subject/chapter
if (!formulaInfo && context?.subject) {
  formulaInfo = `Subject: ${context.subject}\nChapter: ${context.chapter}`;
}

// 3. Final fallback
if (!formulaInfo) {
  formulaInfo = "General JEE Physics topics";
}
```

**Result:** Quiz generation works even without perfect context! ✅

---

## 🔍 **DEBUG CHECKLIST:**

### **Before Testing:**
- [ ] Server restarted (`npm run dev` in apps/server)
- [ ] Browser refreshed (Ctrl + Shift + R)
- [ ] Server terminal visible (to see logs)
- [ ] Browser console open (F12)

### **When Testing Practice Button:**
- [ ] Click button → AI sidebar opens?
- [ ] Message appears in chat?
- [ ] Quiz config form shows?
- [ ] If not, check browser console for errors

### **When Testing Quiz Generation:**
- [ ] Click "Generate Quiz"
- [ ] Check server logs for:
  - [ ] "Quiz generation started"
  - [ ] "Generated prompt length"
  - [ ] "Gemini response received"
- [ ] If error, check error message in:
  - [ ] Server terminal
  - [ ] AI sidebar (red error message)

---

## 📝 **WHAT TO CHECK IN SERVER LOGS:**

### **Success Flow:**
```
✅ Quiz generation started: { user: 'your@email.com', config: 'mains', questionCount: 10, hasContext: true }
✅ Generated prompt length: 1234
✅ Gemini response received, length: 5678
```

### **API Key Issue:**
```
❌ Quiz generation error: Gemini API key not configured
```

### **Gemini Error:**
```
❌ Quiz generation error: Failed to fetch
```
**Fix:** Check internet connection, API key validity

### **Parse Error:**
```
❌ Failed to parse quiz questions: Unexpected token
```
**Fix:** Gemini returned non-JSON. Check logs for actual response.

---

## 🚀 **EXPECTED BEHAVIOR:**

### **Practice Button:**
1. Click "Practice Quiz"
2. AI sidebar opens (if closed)
3. After 500ms: Input field gets "I want to practice these formulas"
4. After 600ms: Form submits automatically
5. Quiz config form appears in chat

### **Quiz Generation:**
1. Fill config form
2. Click "Generate Quiz"
3. Server logs show progress
4. After 10-15 seconds: Navigate to quiz page
5. Quiz loads with questions

---

## 🔧 **MANUAL FIX IF STILL FAILING:**

### **Option 1: Type Manually**
1. Open formula collection
2. AI sidebar is already open
3. Type: "I want to practice these formulas"
4. Press Enter
5. Quiz config form should appear

### **Option 2: Check API Key**
```bash
# In apps/server directory
cat .env | grep GEMINI

# Should show:
# GEMINI_API_KEY=AIza...

# If empty, add your key:
# GEMINI_API_KEY=your_actual_key_here
```

### **Option 3: Test Gemini Directly**
```bash
# In apps/server directory
node -e "
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
model.generateContent('Hello').then(r => console.log('✅ Gemini works!'));
"
```

---

## 📞 **WHAT TO REPORT IF STILL FAILING:**

Please provide:

1. **Server logs** (copy from terminal):
```
Quiz generation started: ...
[PASTE FULL LOG HERE]
```

2. **Error message from AI sidebar**:
```
Failed to generate quiz: [ERROR MESSAGE]
```

3. **Browser console errors** (F12 → Console tab):
```
[PASTE ANY RED ERRORS]
```

4. **API Key status**:
```
✅ API key is set
❌ API key is missing
```

---

## ✅ **WHAT'S BEEN FIXED:**

1. ✅ **Timer label** - Now shows "minutes"
2. ✅ **LaTeX rendering** - Fixed delimiter conversion
3. ✅ **Context handling** - Graceful fallback for missing formulas
4. ✅ **Error messages** - Show actual error instead of generic
5. ✅ **Practice button** - Form submission trigger added
6. ✅ **Logging** - Detailed logs for debugging

---

**TRY IT NOW!** 🚀

1. Restart server
2. Refresh browser
3. Click "Practice Quiz"
4. Watch server logs
5. Report any errors with logs!
