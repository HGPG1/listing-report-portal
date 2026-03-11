# Listing Marketing Report Portal — TODO

## Setup & Infrastructure
- [x] Copy logo assets to CDN (S3 upload, all 6 variants)
- [x] Configure global CSS variables (brand colors, fonts)
- [x] Update index.html with Barlow + Sansita fonts
- [x] Set FUB API key secret

## Database Schema
- [x] listings table (address, MLS, price, dates, agent info, status, narrative)
- [x] weekly_stats table (portal views per platform per week)
- [x] social_posts table (platform, URL, impressions, reach, video views)
- [x] video_stats table (title, platform, URL, views, watch time)
- [x] showings table (date, buyer agent, feedback, star rating)
- [x] offers table (date, price, status, notes)
- [x] magic_links table (token, listing_id, expiry)
- [x] email_log table (listing_id, sent_at, status)
- [x] Run db:push

## Backend API (tRPC Routers)
- [x] listings router: CRUD for listings
- [x] stats router: weekly stats, social posts, video stats
- [x] showings router: showings feedback CRUD
- [x] offers router: offers CRUD
- [x] magicLink router: generate, validate, refresh tokens
- [x] email router: trigger weekly email, log sends
- [x] fub router: POST events to Follow Up Boss API
- [x] analytics router: trends, cross-listing comparisons, predictive insights
- [x] cron job: Monday 8 AM weekly email trigger (America/New_York, configurable)
- [x] Role-based access: restrict admin to approved emails

## Admin Dashboard
- [x] Admin layout with dark navy sidebar navigation
- [x] Listings index page (cards with status badges, hero photo, actions)
- [x] New listing form
- [x] Per-listing tabbed editor (7 tabs: Details, Portal, Social, Showings, Offers, Videos, Email)
- [x] Tab 1: Listing details (address, MLS, price, dates, agent info, status, narrative)
- [x] Tab 2: Portal views weekly entry (Zillow, Realtor.com, Redfin, website + social impressions)
- [x] Tab 3: Social media rows (platform, URL, impressions, reach, video views)
- [x] Tab 4: Showings feedback (date, agent, feedback, star rating)
- [x] Tab 5: Offers (date, price, status, notes)
- [x] Tab 6: Videos (title, platform, URL, views, watch time)
- [x] Tab 7: Magic link & email (copy link, refresh, send now, email log)
- [x] Save confirmation toasts
- [x] Role-based access control (homegrownpropertygroup.com + brianmccarron@gmail.com)

## Client-Facing Seller Report Page
- [x] Public route /report/:token (no auth required)
- [x] Token validation with branded expired-link page
- [x] Hero section (address, photo, price, DOM, status badge, agent card)
- [x] Marketing Activity Summary (animated counters: impressions, video views, portal views, showings)
- [x] Social Media card grid (platform icon, impressions, reach, video views, post link)
- [x] Video Performance cards (title, platform, views, watch time bar)
- [x] Portal Reach bar chart (Zillow / Realtor.com / Redfin / website — weekly)
- [x] Showing Feedback timeline (date, agent, star rating, quote card)
- [x] Offer Activity timeline/table (date, price, status badge, notes)
- [x] Agent Message section (weekly narrative, agent photo)
- [x] Footer (brokerage logo, agent contact)
- [x] Mobile-responsive layout
- [x] Scroll-triggered fade-in animations
- [x] Animated stat counters on load

## Email Template & Automation
- [x] HTML email template (inline CSS, multi-client)
- [x] Weekly cron job (Monday 8 AM, configurable via CRON_SCHEDULE env)
- [x] FUB API integration (POST /v1/events with magic link URL)
- [x] Email log tracking

## Analytics Dashboard
- [x] Portfolio KPI cards (total portal views, impressions, showings, video views)
- [x] Cross-listing comparison bar chart
- [x] Views-to-showings efficiency scatter chart
- [x] Per-listing sparklines + predictive insights

## QA & Testing
- [x] Vitest tests for FUB router and auth logout (4 tests passing)
- [x] TypeScript check: 0 errors
- [x] No green colors in UI (brand constraint enforced)
- [x] All logo references use CDN URLs (no local file dependencies)
- [x] Cron job confirmed running at startup

## Round 2 — Mobile + Features
- [x] Fix AdminLayout mobile sidebar (hamburger toggle, overlay drawer, full-width main on mobile)
- [x] Add hero photo S3 upload widget to listing Details tab
- [x] Add seller-view notification: fire notifyOwner() when magic link is validated/opened

## Round 3 — Zillow API Integration (ABANDONED)
- [x] Applied for Zillow partner program
- [x] Received OAuth credentials but insufficient documentation
- [x] Built OAuth 1.0a service with multiple credential attempts
- [x] All attempts returned HTTP 401 — Zillow support unhelpful
- [x] Decision: Pivot to ListTrac API (better support, clearer documentation)

## Round 4 — Zillow Router + Admin Button
- [x] Add Zillow tRPC router (syncAll, syncListing, getFeedId, getSyncLogs) to routers.ts
- [x] Add Sync from Zillow button + last-synced status card to Weekly Stats tab
- [x] Add admin button to seller report page (visible only to authenticated admins)

## Round 5 — ListTrac API Integration (COMPLETE)
- [x] Build ListTrac service: MD5 token generation, metrics API calls
- [x] Add ListTrac sync UI to admin listing edit (sync button in Weekly Stats tab)
- [x] Integrate ListTrac with nightly cron (replace Zillow cron)
- [x] Add vitest for ListTrac credentials and MD5 token generation
- [x] Set ListTrac environment variables (LISTTRAC_ORG_ID, LISTTRAC_USERNAME, LISTTRAC_PASSWORD)
- [x] Verify ListTrac startup test call succeeds

## Round 6 — ListTrac Expansion (COMPLETE)
- [x] Update weekly_stats schema: add listtracShares, listtracFavorites, listtracVTourViews
- [x] Update weekly_stats schema: add dateRangeStart, dateRangeEnd, platformBreakdown fields
- [x] Enhance ListTrac service to parse platform-specific metrics from API response
- [x] Add syncListingByDateRange support via daysBack parameter
- [x] Add time period selector to Weekly Stats tab (All Time, 7 Day, 14 Day, 30 Day buttons)
- [x] Create metrics summary cards (Views, Inquiries, Shares, Favorites, VTours)
- [x] Platform breakdown stored as JSON in database
- [x] Update nightly cron to pull last 7 days only (lightweight sync)
- [x] Write 12 comprehensive tests for metric parsing and aggregation
- [x] All 23 tests passing (including new expanded tests)


## Debugging — ListTrac Sync Issues (COMPLETE)
- [x] Debug: Sync button - API working, returns 0 metrics for test listing
- [x] Debug: Database updates working - records created with zero values
- [x] Debug: UI now shows "No data synced yet" message when empty
- [x] Fix: Error handling now throws instead of swallowing errors
- [x] Fix: Added date range display to metrics cards
- [x] Verify: ListTrac API returns 19 sites with correct structure
- [x] Verify: Weekly stats query returns correct data
- [x] All 23 tests passing

## Round 7 — ListTrac Complete Rebuild (COMPLETE)
- [x] Rewrite ListTrac service to use getmetricsbyorganization endpoint (MLS ID 44890)
- [x] Fetch ALL listings with metrics in single API call
- [x] Create bulk sync mutation (syncAll) for all MLS listings
- [x] Admin dashboard shows all listings with ListTrac metrics
- [x] Add time period selector (7/14/30 day, all-time) to dashboard
- [x] Update nightly cron to sync all listings automatically (2 AM daily)
- [x] Test end-to-end with real data - working correctly
- [x] Write 8 comprehensive tests for bulk sync - all passing
- [x] All 31 tests passing (8 new bulk sync tests + 23 existing)


## Round 8 — Display ListTrac Metrics on Active Listings (COMPLETE)
- [x] Add getAllWithStats tRPC query to fetch all listings with latest weekly stats
- [x] Update AdminListings to display views, inquiries, shares, favorites, vtours for each listing
- [x] Test and verify metrics display correctly


## Critical Bugs - Round 9
- [x] Add force sync button to Active Listings page
- [x] Fix Weekly Stats sync button - data not updating after sync completes


## Round 10 — Dynamic Listing Management
- [x] Create ListTrac discovery function to fetch all active listings from organization
- [x] Add auto-sync feature to discover new listings and update status
- [x] Create archive system for off-market listings
- [x] Add UI to show active vs archived listings with sync controls
- [x] Test dynamic listing discovery and archiving workflow


## Round 11 — Platform-Specific Metrics from ListTrac
- [x] Extract Zillow views from ListTrac API response
- [x] Extract Realtor.com views from ListTrac API response
- [x] Extract Redfin views from ListTrac API response
- [x] Extract Website views from ListTrac API response
- [x] Update database schema to store platform-specific metrics
- [x] Update weekly stats form to auto-populate from ListTrac
- [x] Test platform-specific data syncing for all listings

## Round 12 — Major Platform Tracking & All-Time Sync
- [x] Update database schema to track major platforms individually (Zillow, Realtor, MLS, OneHome, Trulia)
- [x] Add "other_sources" field to aggregate smaller platforms (40+ sites)
- [x] Update ListTrac service to extract and aggregate platform data correctly
- [x] Add "Sync All Time" button to pull all historical ListTrac data
- [x] Update UI to display major platforms + "Other Sources" aggregation
- [x] Test major platform tracking across all 7 listings

## Round 13 — Fix Life-of-Listing Sync
- [x] Update syncSingleListing to support life-of-listing date range (no upper limit)
- [x] Change ALL TIME button to pass special value (-1) for unlimited history
- [x] Update date range calculation to use listing's original list date when available (5-year fallback)
- [x] Test ALL TIME sync pulls complete listing history from ListTrac (3/10/2021 to 3/9/2026 = 5 years)

## Round 14 — Fix Weekly Stats History Display
- [x] Investigate ListTrac API to determine if it returns weekly or cumulative data (CUMULATIVE)
- [x] Check database to see what weekly_stats records actually exist for each listing (4 records per listing)
- [x] Fix history table to show last 4 weeks with proper Sunday-based week labels ("Week of Mar 8" format)
- [x] Ensure all platform data (Zillow, Realtor, MLS, OneHome, Trulia, Other) displays (not just zeros)
- [x] Add "Beyond" row for older data aggregation (shows total for all weeks beyond last 4)
- [x] Form auto-populates correctly after sync with all 6 platform fields

## Round 15 — Historical Data Backfill & Auto-Sync
- [x] Backfill historical weekly_stats for all existing listings from their list dates (108 records created)
- [x] Detect list dates from ListTrac API (all 8 listings detected successfully)
- [ ] Add auto-sync on new listing creation to pull full history from list date
- [ ] Add week-over-week comparison column to history table
- [ ] Add bulk "Sync All" button to Active Listings page (syncs all active + under contract)
- [ ] Add framework for scheduled Monday 8 AM ET sync (code in place, not activated)
- [x] Test backfill works for Butters Way (1/15 to today = 4,343 total views)

## Round 16 — Fix Week Labels & Add Comparison + Bulk Sync
- [x] Fix week labeling - showing full dates (Mar 8, 2026) with no duplicates
- [x] Add week-over-week comparison column showing % change from previous week (green/red coloring)
- [x] Add bulk "Sync All Time" button to Active Listings page
- [x] Add auto-sync on new listing creation to pull full history from ListTrac

## Round 17 — Fix History Table to Show 3 Periods (7day/30day/lifetime)
- [x] Update history table to show only 3 sync periods instead of individual weeks
- [x] Update sync logic to map weekly records to their corresponding period
- [x] Remove week-over-week comparison (not applicable for periods)
- [x] Test display with Butters Way and verify correct data shows for each period

## Round 18 — Complete Refactor: Single Button Sync All 3 Periods
- [x] Phase 1: Add syncPeriod enum field to schema and run pnpm db:push
- [x] Phase 2: Update listtrac.ts syncSingleListing() to loop through all 3 periods
- [x] Phase 3: Update routers.ts to remove daysBack parameter
- [x] Phase 4: Update AdminListingEdit.tsx to show single Sync All button
- [x] Phase 5: Test sync on Butters Way, verify 3 records created (all 3 periods showing correctly)
- [x] Phase 6: History table fixed to use syncPeriod field instead of date-based logic

## Round 19 — Cleanup Redundant Sync Buttons
- [x] Remove "Sync Metrics" button from Active Listings page (kept "Sync All Time" instead)

## Round 20 — Fix ShowingTime Sync to Search by MLS
- [x] Update IMAP fetcher to accept mlsNumber param and search by SUBJECT containing MLS
- [x] Update router to pass listing's MLS number to fetchShowingTimeEmails()
- [x] Remove 50-email limit when searching by MLS (search all matching emails)
- [x] Add duplicate prevention on emailMessageId
