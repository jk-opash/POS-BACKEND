import cron from "node-cron";
import { prisma } from "../../config/database.js";
import { createNotification } from "../notification/notification.service.js";

export function initCronJobs() {
  // Run every day at midnight server time
  cron.schedule("0 0 * * *", async () => {
    console.log("Running daily subscription check cron job...");
    try {
      await checkExpiringSubscriptions();
    } catch (error) {
      console.error("Error in checkExpiringSubscriptions cron:", error);
    }
  });
}

export async function checkExpiringSubscriptions() {
  const targetDateStart = new Date();
  targetDateStart.setHours(0, 0, 0, 0);

  const targetDateEnd = new Date();
  targetDateEnd.setDate(targetDateEnd.getDate() + 5);
  targetDateEnd.setHours(23, 59, 59, 999);

  // Find businesses whose subscription_ends_at OR subscription_trial_end falls in the next 5 days
  const expiringBusinesses = await prisma.business.findMany({
    where: {
      OR: [
        {
          subscription_ends_at: {
            gte: targetDateStart,
            lte: targetDateEnd,
          },
        },
        {
          subscription_trial_end: {
            gte: targetDateStart,
            lte: targetDateEnd,
          },
        },
      ],
      status: { in: ["active", "trial"] },
    },
  });

  let notificationCount = 0;

  for (const business of expiringBusinesses) {
    const isTrial = business.subscription_status === "trialing";
    const endDate = isTrial ? business.subscription_trial_end : business.subscription_ends_at;

    let daysText = "soon";
    if (endDate) {
      const diffTime = new Date(endDate).getTime() - new Date().getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      daysText = diffDays > 1 ? `in ${diffDays} days` : (diffDays === 1 ? "tomorrow" : (diffDays === 0 ? "today" : "already"));
    }

    const type = isTrial ? "TRIAL_EXPIRING" : "SUBSCRIPTION_EXPIRING";
    const title = isTrial ? "Trial Expiring Soon" : "Subscription Expiring Soon";
    const message = `Your ${isTrial ? "trial" : "subscription plan"} for ${business.name} will expire ${daysText}. Please renew to avoid service interruption.`;

    await createNotification({
      title,
      message,
      type,
      targetBusiness: business.id,
      targetAdmin: true,
    });
    notificationCount++;
  }

  console.log(`Daily subscription check complete. Sent ${notificationCount} notifications.`);
}
