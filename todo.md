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

## Round 3 — Zillow API Integration

- [ ] Retrieve Zillow OAuth secret from secure URL
- [ ] Store ZILLOW_TOKEN and ZILLOW_SECRET as project secrets
- [ ] Build Zillow sync service (OAuth 1.0, per-listing data pull by MLS ID)
- [ ] Add nightly cron job for Zillow sync (runs after midnight when data is fresh)
- [ ] Add zillowLastSynced field to listings table
- [ ] Add manual "Sync Now" button and last-synced status to admin listing edit page
- [ ] Write vitest for Zillow sync service

## Round 3 — Zillow API Integration

- [ ] Build Zillow OAuth 1.0a service (HMAC-SHA1 signature, token secret fallback "none" then "")
- [ ] Store Zillow credentials as project secrets
- [ ] Add zillow_sync_logs table to schema + db:push
- [ ] Build syncZillowListing() and syncAllListings() functions
- [ ] Add nightly cron at 2 AM for Zillow sync
- [ ] Add tRPC routes: zillow.syncListing, zillow.syncAll, zillow.getSyncStatus
- [ ] Add Zillow Sync card to admin listing edit page (last synced, status, manual trigger, error log)
- [ ] Run test call on startup and log result to console
- [ ] Write vitest for Zillow OAuth signature generation

## Round 4 — Zillow Router + Admin Button
- [x] Add Zillow tRPC router (syncAll, syncListing, getFeedId, getSyncLogs) to routers.ts
- [x] Add Sync from Zillow button + last-synced status card to Weekly Stats tab
- [x] Add admin button to seller report page (visible only to authenticated admins)
