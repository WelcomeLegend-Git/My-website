# 📚 Formula Collection View - In Progress

## 🎯 Goal
When you bulk extract formulas, they should all appear together in ONE beautiful interactive page (like Gemini's mind map canvas view) instead of separate cards.

## ✅ What's Done

### 1. Database Structure ✅
**Added:** `FormulaCollection` model
- Groups bulk extracted formulas together
- Stores title (e.g., "8 Formulas - Nov 10, 01:35 AM")
- Links to Subject, Chapter, User
- Has many Formulas

**Updated:** `Formula` model
- Added `collectionId` field
- Links back to collection

### 2. Backend API ✅
**Updated:** `extractAndCreateBulk` endpoint
- Creates a FormulaCollection first
- Links all extracted formulas to the collection
- Returns `collectionId` in response

**Migration:** ✅ Database synced

## 🚧 What's Next (Need to Build)

### 3. Collection View API
Need to add endpoint to fetch collection with all formulas:
```typescript
getCollection: procedure
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    return ctx.prisma.formulaCollection.findUnique({
      where: { id: input.id },
      include: {
        formulas: { include: { assets: true } },
        subject: true,
        chapter: true,
      },
    });
  })
```

### 4. Frontend Collection View Component
**File to create:** `apps/web/src/features/formulas/components/FormulaCollectionView.tsx`

**Layout (Gemini-style):**
```
┌────────────────────────────────────────────────┐
│  📚 8 Kinematics Formulas                      │
│  Physics > Kinematics                          │
│  Extracted: Nov 10, 01:35 AM                   │
│                                                │
│  [Expand All] [Collapse All]                   │
├────────────────────────────────────────────────┤
│                                                │
│  ▼ 1. Instantaneous Speed                      │
│     Expression: v(t) = |v(t)|                  │
│     ─────────────────────────────────────────  │
│     Explanation: Instantaneous speed is...     │
│                                                │
│     ▶ Applications (click to expand)           │
│     ▶ Worked Examples (2)                      │
│     ▶ Derivation Steps (3)                     │
│     ▶ Common Mistakes (2)                      │
│                                                │
│  ▼ 2. Average Velocity                         │
│     Expression: v̄ = Δx/Δt                      │
│     ─────────────────────────────────────────  │
│     ...                                        │
│                                                │
│  ▶ 3. Average Speed                            │
│                                                │
└────────────────────────────────────────────────┘
```

**Features:**
- ✅ Expand/Collapse individual formulas
- ✅ Expand/Collapse All button
- ✅ Beautiful card-based layout
- ✅ LaTeX rendering with KaTeX
- ✅ Markdown support for explanations
- ✅ Nested sections for Examples, Applications, etc.
- ✅ Smooth animations
- ✅ Professional typography

### 5. Routing & Navigation
**Add route:** `/formulas/collections/:collectionId`
**Update:** `FormulaFormDialog` to navigate to collection view after success

### 6. Collection List Page (Optional)
Show all your formula collections:
```
📚 My Formula Collections
- 8 Kinematics Formulas (Nov 10)
- 12 Thermodynamics Formulas (Nov 9)
- 5 Electrostatics Formulas (Nov 8)
```

---

## 🛠️ Implementation Plan

### Step 1: Create Collection View Component
- Use React state for expand/collapse
- KaTeX for LaTeX rendering
- Markdown for text
- TailwindCSS for styling

### Step 2: Add tRPC Endpoint
- `getCollection` query
- Include all formulas with full data

### Step 3: Create Route
- `/formulas/collections/:id`
- FormulaCollectionPage component

### Step 4: Update Bulk Extract Flow
- After success, redirect to collection view
- Pass collection ID

### Step 5: Test & Polish
- Ensure all features work
- Add animations
- Perfect the UI

---

## 🎨 Design Inspiration

**Like Gemini AI's Canvas View:**
- Clean, spacious layout
- Expandable sections
- Beautiful typography
- Smooth animations
- Interactive elements

**Better Than Individual Cards Because:**
- ✅ All related formulas in one place
- ✅ Easy to compare formulas
- ✅ Clear organization
- ✅ Professional presentation
- ✅ Easy to study from

---

## 📊 Current Status

- [x] Database schema with FormulaCollection
- [x] Backend creates collections
- [x] Backend links formulas to collections
- [ ] Collection view component
- [ ] Collection fetch API
- [ ] Routing setup
- [ ] Navigation after bulk extract
- [ ] Testing

**Next:** Build the FormulaCollectionView component!

---

## 🚀 Timeline

**Now:** Database & backend ready
**Next 30 min:** Build collection view component
**After that:** Wire up routing and navigation
**Result:** Beautiful grouped formula view!

---

**Want me to build the collection view component now?** 🎨
