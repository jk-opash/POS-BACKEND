import { prisma } from "../config/database.js";

/**
 * Middleware to block API access for businesses whose subscription has expired.
 * 
 * - Superadmins are always allowed through.
 * - Admin/staff roles have their business's `current_period_end` checked.
 * - If the subscription has expired, all API calls return 403 until the superadmin
 *   extends the plan's `current_period_end`.
 */
export async function requireActiveSubscription(req, res, next) {
  try {
    const actor = req.actor;

    // Superadmins are never blocked
    if (!actor || actor.role === "superadmin") {
      return next();
    }

    const businessId = actor.businessId;
    if (!businessId) return next();

    // Fetch the business and its linked subscription plan
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        subscription_plan: {
          select: {
            status: true,
            current_period_end: true,
            trial_end_date: true,
          },
        },
      },
    });

    const plan = business?.subscription_plan;

    // If no plan is linked, let it through (provisioning edge case)
    if (!plan) return next();

    const now = new Date();

    // During trial: allow if trial hasn't ended yet
    if (plan.status === "trialing") {
      if (plan.trial_end_date && now > new Date(plan.trial_end_date)) {
        return res.status(403).json({
          error: "subscription_expired",
          message:
            "Your free trial has ended. Please contact your administrator to activate your subscription.",
        });
      }
      return next();
    }

    // Active subscription: check the billing period end date
    if (plan.current_period_end && now > new Date(plan.current_period_end)) {
      return res.status(403).json({
        error: "subscription_expired",
        message:
          "Your subscription has expired. Please contact your administrator to renew.",
      });
    }

    next();
  } catch (err) {
    console.error("[SubscriptionMiddleware] Error:", err.message);
    // On unexpected error, fail open so the app doesn't hard-break
    next();
  }
}
