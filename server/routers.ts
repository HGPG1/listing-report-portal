import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { nanoid } from "nanoid";
import {
  getAllListings,
  getListingById,
  createListing,
  updateListing,
  deleteListing,
  getFullListingData,
  createMagicLink,
  getMagicLinkByToken,
  getActiveMagicLinkForListing,
  upsertWeeklyStats,
  getWeeklyStatsForListing,
  createSocialPost,
  updateSocialPost,
  deleteSocialPost,
  createVideoStat,
  updateVideoStat,
  deleteVideoStat,
  createShowing,
  updateShowing,
  deleteShowing,
  createOffer,
  updateOffer,
  deleteOffer,
  logEmail,
  getEmailLogForListing,
  getAnalyticsOverview,
} from "./db";
import { sendWeeklyReportToFub } from "./fub";
import { runWeeklyEmailJob } from "./cron";
import { notifyOwner } from "./_core/notification";
import { storagePut } from "./storage";
import { syncAllZillowListings, syncZillowListing, discoverFeedId, getZillowSyncLogs } from "./zillow";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

// ─── Admin Guard ─────────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const email = ctx.user?.email ?? "";
  const isApproved =
    email === "brianmccarron@gmail.com" ||
    email.endsWith("@homegrownpropertygroup.com") ||
    ctx.user?.role === "admin";
  if (!isApproved) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access restricted to Home Grown Property Group team members.",
    });
  }
  return next({ ctx });
});

// ─── Listings Router ──────────────────────────────────────────────────────────
const listingsRouter = router({
  list: adminProcedure.query(async () => {
    return getAllListings();
  }),

  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const listing = await getListingById(input.id);
      if (!listing) throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      return listing;
    }),

  getFull: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const data = await getFullListingData(input.id);
      if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      return data;
    }),

  create: adminProcedure
    .input(z.object({
      address: z.string().min(1),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      mlsNumber: z.string().optional(),
      listPrice: z.string().optional(),
      listDate: z.date().optional(),
      targetCloseDate: z.date().optional(),
      heroPhotoUrl: z.string().optional(),
      status: z.enum(["Active", "Under Contract", "Sold", "Back on Market", "Withdrawn"]).default("Active"),
      agentName: z.string().optional(),
      agentEmail: z.string().optional(),
      agentPhone: z.string().optional(),
      agentPhotoUrl: z.string().optional(),
      sellerName: z.string().optional(),
      sellerEmail: z.string().optional(),
      fubContactId: z.string().optional(),
      weeklyNarrative: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await createListing({ ...input, createdByUserId: ctx.user.id });
      // Auto-generate magic link
      const allListings = await getAllListings();
      const newListing = allListings[0]; // most recent
      if (newListing) {
        const token = nanoid(48);
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        await createMagicLink({ listingId: newListing.id, token, expiresAt });
      }
      return { success: true };
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      mlsNumber: z.string().optional(),
      listPrice: z.string().optional(),
      listDate: z.date().optional().nullable(),
      targetCloseDate: z.date().optional().nullable(),
      heroPhotoUrl: z.string().optional().nullable(),
      status: z.enum(["Active", "Under Contract", "Sold", "Back on Market", "Withdrawn"]).optional(),
      agentName: z.string().optional(),
      agentEmail: z.string().optional(),
      agentPhone: z.string().optional(),
      agentPhotoUrl: z.string().optional().nullable(),
      sellerName: z.string().optional(),
      sellerEmail: z.string().optional(),
      fubContactId: z.string().optional(),
      weeklyNarrative: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateListing(id, data as any);
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteListing(input.id);
      return { success: true };
    }),
});

// ─── Magic Links Router ───────────────────────────────────────────────────────
const magicLinksRouter = router({
  getForListing: adminProcedure
    .input(z.object({ listingId: z.number() }))
    .query(async ({ input }) => {
      const link = await getActiveMagicLinkForListing(input.listingId);
      if (!link) return null;
      return {
        ...link,
        url: `${BASE_URL}/report/${link.token}`,
        isExpired: new Date() > link.expiresAt,
      };
    }),

  refresh: adminProcedure
    .input(z.object({ listingId: z.number() }))
    .mutation(async ({ input }) => {
      const token = nanoid(48);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await createMagicLink({ listingId: input.listingId, token, expiresAt });
      return { token, url: `${BASE_URL}/report/${token}`, expiresAt };
    }),

  // Public: validate token and return listing data for seller report
  validate: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const link = await getMagicLinkByToken(input.token);
      if (!link) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or expired link" });
      if (new Date() > link.expiresAt) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This link has expired. Contact your agent." });
      }
      const data = await getFullListingData(link.listingId);
      if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      // Fire-and-forget owner notification — don't block the response
      notifyOwner({
        title: `Seller viewed report: ${data.listing.address}`,
        content: `${data.listing.sellerName ?? "Your seller"} just opened their marketing report for ${data.listing.address}. View the listing: ${BASE_URL}/admin/listings/${data.listing.id}/edit`,
      }).catch(() => {/* non-critical */});
      return data;
    }),

  // Upload hero/agent photo to S3 and return URL
  uploadPhoto: adminProcedure
    .input(z.object({
      base64: z.string(),          // data:image/...;base64,...
      filename: z.string(),
      listingId: z.number(),
      type: z.enum(["hero", "agent"]),
    }))
    .mutation(async ({ input }) => {
      const matches = input.base64.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid base64 image" });
      const contentType = matches[1];
      const buffer = Buffer.from(matches[2], "base64");
      const ext = input.filename.split(".").pop() ?? "jpg";
      const key = `listings/${input.listingId}/${input.type}-${nanoid(8)}.${ext}`;
      const { url } = await storagePut(key, buffer, contentType);
      return { url };
    }),
});

// ─── Stats Router ─────────────────────────────────────────────────────────────
const statsRouter = router({
  getWeekly: adminProcedure
    .input(z.object({ listingId: z.number() }))
    .query(async ({ input }) => getWeeklyStatsForListing(input.listingId)),

  upsertWeekly: adminProcedure
    .input(z.object({
      listingId: z.number(),
      weekOf: z.date(),
      zillowViews: z.number().default(0),
      realtorViews: z.number().default(0),
      redfinViews: z.number().default(0),
      websiteViews: z.number().default(0),
      totalImpressions: z.number().default(0),
      totalVideoViews: z.number().default(0),
      totalShowings: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      await upsertWeeklyStats(input);
      return { success: true };
    }),

  // Social Posts
  createSocial: adminProcedure
    .input(z.object({
      listingId: z.number(),
      platform: z.enum(["Instagram", "Facebook", "TikTok", "YouTube", "LinkedIn", "Twitter", "Other"]),
      postUrl: z.string().optional(),
      thumbnailUrl: z.string().optional(),
      impressions: z.number().default(0),
      reach: z.number().default(0),
      linkClicks: z.number().default(0),
      videoViews: z.number().default(0),
      postedAt: z.date().optional(),
    }))
    .mutation(async ({ input }) => {
      await createSocialPost(input);
      return { success: true };
    }),

  updateSocial: adminProcedure
    .input(z.object({
      id: z.number(),
      platform: z.enum(["Instagram", "Facebook", "TikTok", "YouTube", "LinkedIn", "Twitter", "Other"]).optional(),
      postUrl: z.string().optional(),
      thumbnailUrl: z.string().optional(),
      impressions: z.number().optional(),
      reach: z.number().optional(),
      linkClicks: z.number().optional(),
      videoViews: z.number().optional(),
      postedAt: z.date().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateSocialPost(id, data);
      return { success: true };
    }),

  deleteSocial: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteSocialPost(input.id);
      return { success: true };
    }),

  // Video Stats
  createVideo: adminProcedure
    .input(z.object({
      listingId: z.number(),
      title: z.string().min(1),
      platform: z.enum(["YouTube", "Instagram", "TikTok", "Facebook", "Other"]),
      videoUrl: z.string().optional(),
      thumbnailUrl: z.string().optional(),
      viewCount: z.number().default(0),
      watchTimeMinutes: z.number().default(0),
      publishedAt: z.date().optional(),
    }))
    .mutation(async ({ input }) => {
      await createVideoStat(input);
      return { success: true };
    }),

  updateVideo: adminProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      platform: z.enum(["YouTube", "Instagram", "TikTok", "Facebook", "Other"]).optional(),
      videoUrl: z.string().optional(),
      thumbnailUrl: z.string().optional(),
      viewCount: z.number().optional(),
      watchTimeMinutes: z.number().optional(),
      publishedAt: z.date().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateVideoStat(id, data);
      return { success: true };
    }),

  deleteVideo: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteVideoStat(input.id);
      return { success: true };
    }),
});

// ─── Showings Router ──────────────────────────────────────────────────────────
const showingsRouter = router({
  create: adminProcedure
    .input(z.object({
      listingId: z.number(),
      showingDate: z.date(),
      buyerAgentName: z.string().optional(),
      buyerAgentEmail: z.string().optional(),
      feedbackSummary: z.string().optional(),
      starRating: z.number().min(1).max(5).optional(),
    }))
    .mutation(async ({ input }) => {
      await createShowing(input);
      return { success: true };
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      showingDate: z.date().optional(),
      buyerAgentName: z.string().optional(),
      buyerAgentEmail: z.string().optional(),
      feedbackSummary: z.string().optional(),
      starRating: z.number().min(1).max(5).optional().nullable(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateShowing(id, data);
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteShowing(input.id);
      return { success: true };
    }),
});

// ─── Offers Router ────────────────────────────────────────────────────────────
const offersRouter = router({
  create: adminProcedure
    .input(z.object({
      listingId: z.number(),
      offerDate: z.date(),
      offerPrice: z.string().optional(),
      status: z.enum(["Active", "Countered", "Declined", "Accepted", "Expired"]).default("Active"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await createOffer(input);
      return { success: true };
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      offerDate: z.date().optional(),
      offerPrice: z.string().optional(),
      status: z.enum(["Active", "Countered", "Declined", "Accepted", "Expired"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateOffer(id, data);
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteOffer(input.id);
      return { success: true };
    }),
});

// ─── Email Router ─────────────────────────────────────────────────────────────
const emailRouter = router({
  getLog: adminProcedure
    .input(z.object({ listingId: z.number() }))
    .query(async ({ input }) => getEmailLogForListing(input.listingId)),

  sendNow: adminProcedure
    .input(z.object({ listingId: z.number() }))
    .mutation(async ({ input }) => {
      const listing = await getListingById(input.listingId);
      if (!listing) throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      if (!listing.fubContactId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No FUB Contact ID configured for this listing" });
      }

      const magicLink = await getActiveMagicLinkForListing(input.listingId);
      if (!magicLink) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No active magic link. Please generate one first." });
      }

      const magicLinkUrl = `${BASE_URL}/report/${magicLink.token}`;
      const { eventId } = await sendWeeklyReportToFub({
        fubContactId: listing.fubContactId,
        listingAddress: listing.address,
        magicLinkUrl,
        agentName: listing.agentName ?? undefined,
      });

      await logEmail({
        listingId: input.listingId,
        status: eventId ? "sent" : "failed",
        fubEventId: eventId ?? undefined,
        errorMessage: eventId ? undefined : "FUB event post failed",
      });

      return { success: !!eventId, eventId };
    }),

  // Test endpoint — admin only trigger for cron job
  triggerWeeklyJob: adminProcedure
    .mutation(async () => {
      const result = await runWeeklyEmailJob();
      return result;
    }),
});

// ─── Analytics Router ─────────────────────────────────────────────────────────
const analyticsRouter = router({
  overview: adminProcedure.query(async () => {
    const data = await getAnalyticsOverview();
    if (!data) return { listings: [], weeklyStats: [], insights: [] };

    const { listings: allListings, weeklyStats: allStats } = data;

    // Build per-listing aggregates
    const listingMap = new Map(allListings.map(l => [l.id, l]));
    const statsByListing = new Map<number, typeof allStats>();
    for (const stat of allStats) {
      if (!statsByListing.has(stat.listingId)) statsByListing.set(stat.listingId, []);
      statsByListing.get(stat.listingId)!.push(stat);
    }

    const listingPerformance = allListings.map(listing => {
      const stats = statsByListing.get(listing.id) ?? [];
      const totalPortal = stats.reduce((s, w) =>
        s + (w.zillowViews ?? 0) + (w.realtorViews ?? 0) + (w.redfinViews ?? 0) + (w.websiteViews ?? 0), 0);
      const totalImpressions = stats.reduce((s, w) => s + (w.totalImpressions ?? 0), 0);
      const totalVideoViews = stats.reduce((s, w) => s + (w.totalVideoViews ?? 0), 0);
      const totalShowings = stats.reduce((s, w) => s + (w.totalShowings ?? 0), 0);
      const weeksActive = stats.length;
      const listDate = listing.listDate ? new Date(listing.listDate) : null;
      const daysOnMarket = listDate
        ? Math.floor((Date.now() - listDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      // Trend: compare last 2 weeks
      const sorted = [...stats].sort((a, b) => new Date(b.weekOf).getTime() - new Date(a.weekOf).getTime());
      const thisWeekPortal = sorted[0]
        ? (sorted[0].zillowViews ?? 0) + (sorted[0].realtorViews ?? 0) + (sorted[0].redfinViews ?? 0) + (sorted[0].websiteViews ?? 0)
        : 0;
      const lastWeekPortal = sorted[1]
        ? (sorted[1].zillowViews ?? 0) + (sorted[1].realtorViews ?? 0) + (sorted[1].redfinViews ?? 0) + (sorted[1].websiteViews ?? 0)
        : 0;
      const portalTrend = lastWeekPortal > 0
        ? Math.round(((thisWeekPortal - lastWeekPortal) / lastWeekPortal) * 100)
        : 0;

      // Predictive insight
      let insight = "";
      if (daysOnMarket !== null && daysOnMarket > 21 && totalShowings < 3) {
        insight = "Low showing activity after 3+ weeks. Consider price adjustment or marketing refresh.";
      } else if (portalTrend < -20) {
        insight = "Portal views declining week-over-week. Boost social media activity to drive traffic.";
      } else if (totalShowings >= 5 && stats.length > 0) {
        insight = "Strong showing activity. Ensure follow-up with all buyer agents for feedback.";
      } else if (totalImpressions > 10000 && totalShowings < 2) {
        insight = "High impressions but low showings. Review listing photos and price positioning.";
      }

      return {
        listingId: listing.id,
        address: listing.address,
        status: listing.status,
        listPrice: listing.listPrice,
        daysOnMarket,
        weeksActive,
        totalPortalViews: totalPortal,
        totalImpressions,
        totalVideoViews,
        totalShowings,
        portalTrend,
        weeklyBreakdown: sorted.slice(0, 8).map(s => ({
          weekOf: s.weekOf,
          portalViews: (s.zillowViews ?? 0) + (s.realtorViews ?? 0) + (s.redfinViews ?? 0) + (s.websiteViews ?? 0),
          impressions: s.totalImpressions ?? 0,
          videoViews: s.totalVideoViews ?? 0,
          showings: s.totalShowings ?? 0,
        })),
        insight,
      };
    });

    return { listingPerformance };
  }),
});

// ─── Zillow Router ──────────────────────────────────────────────────────────
const zillowRouter = router({
  // Discover feed ID (Canopy MLS)
  getFeedId: adminProcedure.query(async () => {
    const { feedId, error, httpStatus, responseBody } = await discoverFeedId();
    return { feedId, error, httpStatus, responseBody };
  }),

  // Sync all active listings
  syncAll: adminProcedure.mutation(async () => {
    const result = await syncAllZillowListings();
    return result;
  }),

  // Sync a single listing by ID
  syncListing: adminProcedure
    .input(z.object({ listingId: z.number(), mlsNumber: z.string(), feedId: z.number() }))
    .mutation(async ({ input }) => {
      return syncZillowListing(input.listingId, input.mlsNumber, input.feedId);
    }),

  // Get sync logs for a listing (or all listings)
  getSyncLogs: adminProcedure
    .input(z.object({ listingId: z.number().optional(), limit: z.number().default(20) }))
    .query(async ({ input }) => {
      return getZillowSyncLogs(input.listingId, input.limit);
    }),
});

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  listings: listingsRouter,
  magicLinks: magicLinksRouter,
  stats: statsRouter,
  showings: showingsRouter,
  offers: offersRouter,
  email: emailRouter,
  analytics: analyticsRouter,
  zillow: zillowRouter,
});

export type AppRouter = typeof appRouter;
