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

  const expiringPlans = await prisma.subscriptionPlan.findMany({
    where: {
      OR: [
        {
          current_period_end: {
            gte: targetDateStart,
            lte: targetDateEnd,
          },
        },
        {
          trial_end_date: {
            gte: targetDateStart,
            lte: targetDateEnd,
          },
        },
      ],
      is_active: true
    },
    include: {
      businesses: true,
    },
  });

  let notificationCount = 0;

  for (const plan of expiringPlans) {
    for (const business of plan.businesses) {
      if (business.status === 'active' || business.status === 'trial') {
        const isTrial = plan.status === 'trialing';
        
        const endDate = isTrial ? plan.trial_end_date : plan.current_period_end;
        let daysText = "soon";
        if (endDate) {
          const diffTime = endDate.getTime() - new Date().getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          daysText = diffDays > 1 ? `in ${diffDays} days` : (diffDays === 1 ? 'tomorrow' : (diffDays === 0 ? 'today' : 'already'));
        }

        const type = isTrial ? 'TRIAL_EXPIRING' : 'SUBSCRIPTION_EXPIRING';
        const title = isTrial ? 'Trial Expiring Soon' : 'Subscription Expiring Soon';
        const message = `Your ${isTrial ? 'trial' : 'subscription plan'} for ${business.name} will expire ${daysText}. Please renew to avoid service interruption.`;

        await createNotification({
          title,
          message,
          type,
          targetBusiness: business.id,
          targetAdmin: true,
        });
        notificationCount++;
      }
    }
  }

  console.log(`Daily subscription check complete. Sent ${notificationCount} notifications.`);
}
