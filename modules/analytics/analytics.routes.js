import { Router } from "express";
import { getDashboardStatsHandler, getItemWiseSalesHandler, getTaxLiabilityHandler, getDiscountsVoidsHandler, getHourlyTrendsHandler, getStockVarianceHandler, getStaffPerformanceHandler, getConsumptionReportHandler, getExpenseReportHandler } from "./analytics.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = Router();

// GET /api/analytics/dashboard (requires auth — uses businessId from JWT)
router.get("/dashboard", authenticate, getDashboardStatsHandler);

// GET /api/analytics/item-wise-sales
router.get("/item-wise-sales", authenticate, getItemWiseSalesHandler);

// GET /api/analytics/tax-liability
router.get("/tax-liability", authenticate, getTaxLiabilityHandler);

// GET /api/analytics/discounts-voids
router.get("/discounts-voids", authenticate, getDiscountsVoidsHandler);

// GET /api/analytics/hourly-trends
router.get("/hourly-trends", authenticate, getHourlyTrendsHandler);

// GET /api/analytics/stock-variance
router.get("/stock-variance", authenticate, getStockVarianceHandler);

// GET /api/analytics/staff-performance
router.get("/staff-performance", authenticate, getStaffPerformanceHandler);

// GET /api/analytics/consumption-report
router.get("/consumption-report", authenticate, getConsumptionReportHandler);

// GET /api/analytics/expense-report
router.get("/expense-report", authenticate, getExpenseReportHandler);

export default router;
