import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Update user year access flags at the end of each year
 * Runs on December 31st at 23:59
 */
export const updateYearAccess = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    console.log("Starting year-end access update...");
    
    const now = Date.now();
    let usersUpdated = 0;
    let usersChecked = 0;

    // Get all users with active year access
    const allUsers = await ctx.db
      .query("users")
      .collect();

    for (const user of allUsers) {
      if (!user.hasActiveYearAccess) {
        continue; // Skip users without active access
      }
      
      usersChecked++;

      // Get all user products using index (no runtime filters)
      const allUserProducts = await ctx.db
        .query("userProducts")
        .withIndex("by_user_status", (q) => q.eq("userId", user._id).eq("status", "active"))
        .collect();
      
      // Filter by hasAccess in-memory (per Convex guidelines)
      const userProducts = allUserProducts.filter(up => up.hasAccess === true);

      // Check if any product still has valid access
      let hasValidAccess = false;
      for (const userProduct of userProducts) {
        if (!userProduct.accessExpiresAt || userProduct.accessExpiresAt > now) {
          hasValidAccess = true;
          break;
        }
      }

      // Update user's access flag if status changed
      if (!hasValidAccess && user.hasActiveYearAccess) {
        await ctx.db.patch(user._id, {
          hasActiveYearAccess: false,
        });
        usersUpdated++;
        console.log(`Revoked access for user ${user._id}`);
      }

      // Also update expired userProducts status
      for (const userProduct of userProducts) {
        if (userProduct.accessExpiresAt && userProduct.accessExpiresAt <= now) {
          await ctx.db.patch(userProduct._id, {
            status: "expired",
            hasAccess: false,
          });
        }
      }
    }

    console.log(`Year-end access update completed. Checked ${usersChecked} users, updated ${usersUpdated} users.`);
    return null;
  },
});

/**
 * Manual trigger to update year access (for testing or manual runs)
 */
export const manualUpdateYearAccess = internalMutation({
  args: {},
  returns: v.object({
    usersChecked: v.number(),
    usersUpdated: v.number(),
  }),
  handler: async (ctx) => {
    console.log("Starting manual year access update...");
    
    const now = Date.now();
    let usersUpdated = 0;
    let usersChecked = 0;

    const allUsers = await ctx.db
      .query("users")
      .collect();

    for (const user of allUsers) {
      if (!user.hasActiveYearAccess) {
        continue;
      }
      
      usersChecked++;

      // Fetch active user products using index (no runtime filters)
      const allUserProducts = await ctx.db
        .query("userProducts")
        .withIndex("by_user_status", (q) => q.eq("userId", user._id).eq("status", "active"))
        .collect();
      
      // Filter by hasAccess in-memory (as per Convex guidelines)
      const userProducts = allUserProducts.filter(up => up.hasAccess === true);

      let hasValidAccess = false;
      for (const userProduct of userProducts) {
        if (!userProduct.accessExpiresAt || userProduct.accessExpiresAt > now) {
          hasValidAccess = true;
          break;
        }
      }

      if (!hasValidAccess && user.hasActiveYearAccess) {
        await ctx.db.patch(user._id, {
          hasActiveYearAccess: false,
        });
        usersUpdated++;
      }

      for (const userProduct of userProducts) {
        if (userProduct.accessExpiresAt && userProduct.accessExpiresAt <= now) {
          await ctx.db.patch(userProduct._id, {
            status: "expired",
            hasAccess: false,
          });
        }
      }
    }

    console.log(`Manual update completed. Checked ${usersChecked} users, updated ${usersUpdated} users.`);
    
    return {
      usersChecked,
      usersUpdated,
    };
  },
});

// Define cron schedule
const crons = cronJobs();

// Run at 23:59 on December 31st every year
crons.cron("update_year_access", "59 23 31 12 *", internal.crons.updateYearAccess, {});

export default crons;

