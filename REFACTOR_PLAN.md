# Complete Refactor Plan: Single Sync Button (7day/30day/lifetime)

## PHASE 1: CODE AUDIT RESULTS

### Files that reference weeklyStats:
1. **drizzle/schema.ts** — Table definition, relations, types
2. **server/db.ts** — Query helpers (upsertWeeklyStats, getWeeklyStatsForListing, etc.)
3. **server/listtrac.ts** — Sync logic (syncSingleListing, syncAllListingsFromMLS)
4. **server/listtrac-new-sync.ts** — Partial refactor attempt (DELETE THIS FILE)
5. **server/listtrac-bulk-sync.test.ts** — Tests
6. **server/routers.ts** — Router mutations (stats.upsert, listtrac.syncListing, etc.)
7. **server/cron.ts** — Scheduled sync job
8. **client/src/pages/AdminListingEdit.tsx** — Form to enter/edit stats, sync button
9. **client/src/pages/AdminListings.tsx** — List view with stats display
10. **client/src/pages/SellerReport.tsx** — Report generation using stats

---

## PHASE 2: CHANGE MAP

### Schema Changes (drizzle/schema.ts)
**Current state:**
- weeklyStats table has: listingId, weekOf, zillowViews, realtorViews, redfinViews, websiteViews, etc.
- No syncPeriod field

**New state:**
- Add: `syncPeriod: mysqlEnum("syncPeriod", ["7day", "30day", "lifetime"]).notNull()`
- Keep: All other fields (they're used for manual entry)
- Unique constraint: (listingId, syncPeriod) — only one record per period per listing

---

### Database Functions (server/db.ts)
**upsertWeeklyStats(data: InsertWeeklyStat)**
- Currently: Upserts by (listingId, weekOf)
- New: Should upsert by (listingId, syncPeriod) instead
- This is for MANUAL stat entry (when agents enter data manually)
- Requires syncPeriod in input

**getWeeklyStatsForListing(listingId: number)**
- Currently: Returns all records ordered by weekOf desc
- New: Should filter by syncPeriod and return only the 3 periods
- Or: Keep as-is and filter in the UI

---

### ListTrac Sync Logic (server/listtrac.ts)
**syncSingleListing(listingId: number)**
- Currently: Takes daysBack parameter, creates one record per week
- New: Takes only listingId, creates 3 records (one per period: 7day, 30day, lifetime)
- Calls ListTrac API 3 times (once for each period)
- Each call stores result with syncPeriod field

**syncAllListingsFromMLS(daysBack?: number)**
- Currently: Syncs all listings with a specific daysBack
- New: Should call syncSingleListing for each listing (which handles all 3 periods)
- Or: Keep as-is but update to handle syncPeriod

---

### Router Mutations (server/routers.ts)
**listtrac.syncListing**
- Currently: Input = {listingId, daysBack}
- New: Input = {listingId} only
- Returns: {sevenDay, thirtyDay, lifetime} results

**listtrac.syncAll**
- Currently: Input = {daysBack}
- New: Input = {} (no parameters)
- Syncs all listings, all 3 periods

**stats.upsert** (manual entry)
- Currently: Input has zillowViews, realtorViews, etc.
- New: Must add syncPeriod to input
- Maps input fields to database fields

---

### UI Changes (client/src/pages/AdminListingEdit.tsx)
**Sync button**
- Currently: 4 buttons (7 DAY, 14 DAY, 30 DAY, ALL TIME)
- New: 1 button (SYNC ALL)
- Calls mutation with just listingId
- Form auto-populates with 7day data

**History table**
- Currently: Shows last 4 weeks + beyond
- New: Shows 3 rows (Last 7 Days, Last 30 Days, Life of Listing)
- Filters weeklyStats by syncPeriod instead of weekOf

---

## PHASE 3: EXECUTION ORDER (DO NOT DEVIATE)

### Step 1: Delete old refactor attempt
- Delete: server/listtrac-new-sync.ts

### Step 2: Update schema
- Add syncPeriod field to weeklyStats table
- Run: pnpm db:push

### Step 3: Update server/listtrac.ts
- Modify syncSingleListing() to:
  - Remove daysBack parameter
  - Loop through 3 periods
  - Call ListTrac API 3 times
  - Store each result with syncPeriod
- Modify syncAllListingsFromMLS() to:
  - Call syncSingleListing() for each listing (no daysBack)

### Step 4: Update server/db.ts
- Modify upsertWeeklyStats() to handle syncPeriod
- Add new function: getWeeklyStatsByPeriod(listingId, period)
- Update getFullListingData() to filter by syncPeriod

### Step 5: Update server/routers.ts
- Update listtrac.syncListing input (remove daysBack)
- Update listtrac.syncAll input (remove daysBack)
- Update stats.upsert to require syncPeriod
- Update return types to match new data structure

### Step 6: Update client/src/pages/AdminListingEdit.tsx
- Replace 4 period buttons with 1 "SYNC ALL" button
- Update mutation call to not pass daysBack
- Update history table to show 3 periods (not weeks)
- Update form to auto-populate from 7day period

### Step 7: Update other UI files
- AdminListings.tsx: Update stats display
- SellerReport.tsx: Update stats queries

### Step 8: Update tests
- listtrac-bulk-sync.test.ts: Update to expect syncPeriod

### Step 9: Verify build
- Run: pnpm build
- Check for TypeScript errors
- Check for runtime errors

### Step 10: Test sync
- Navigate to a listing
- Click SYNC ALL button
- Verify 3 records created (one per period)
- Verify form auto-populates
- Verify history table shows 3 rows

---

## PHASE 4: ROLLBACK POINTS

If anything breaks:
1. After schema migration: Rollback to a759cd64
2. After listtrac.ts changes: Rollback to a759cd64
3. After any step: Rollback to a759cd64

---

## KEY RULES

1. **Do NOT make changes incrementally** — Complete each step fully before moving to next
2. **Do NOT test until all changes are done** — Build must be clean before testing
3. **Do NOT skip files** — Every reference to weeklyStats must be updated
4. **Do NOT guess** — If unsure, check the audit results above
5. **Do NOT commit** — Only save checkpoint after all steps complete and build is clean
