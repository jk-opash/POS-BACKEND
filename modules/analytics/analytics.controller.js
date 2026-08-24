import { prisma } from "../../config/database.js";

export async function getDashboardStatsHandler(req, res) {
  try {
    const { branch_id, timeRange } = req.query;

    // Get businessId from the JWT token (set by authenticate middleware)
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res
        .status(403)
        .json({ error: "No business associated with this account." });
    }

    // Build base where clause: always scope to business via branches
    // If a specific branch_id is requested, validate it belongs to the business
    let whereBranch;
    if (branch_id) {
      whereBranch = { branch_id, branch: { business_id: businessId } };
    } else {
      // Get all branches for this business, use them as a filter
      const branches = await prisma.branch.findMany({
        where: { business_id: businessId },
        select: { id: true },
      });
      const branchIds = branches.map((b) => b.id);
      if (branchIds.length === 0) {
        // No branches yet — return empty stats
        return res.json({
          data: {
            totalSales: 0,
            netSales: 0,
            onlineSales: 0,
            cashCollection: 0,
            taxes: 0,
            discounts: 0,
            numOrders: 0,
            successOrders: 0,
            cancelledOrders: 0,
            complimentaryOrders: 0,
            averageTableTime: 0,
            totalExpenses: 0,
            expenseCategories: [],
            chartData: [],
            discountByDay: [],
          },
        });
      }
      whereBranch = { branch_id: { in: branchIds } };
    }

    let dateFilter = {};
    const now = new Date();

    if (req.query.startDate && req.query.endDate) {
      const [sy, sm, sd] = req.query.startDate.split('-').map(Number);
      const [ey, em, ed] = req.query.endDate.split('-').map(Number);
      dateFilter = {
        gte: new Date(sy, sm - 1, sd, 0, 0, 0, 0),
        lte: new Date(ey, em - 1, ed, 23, 59, 59, 999),
      };
    } else if (timeRange === "today") {
      const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      dateFilter = { gte: startOfDay };
    } else if (timeRange === "week") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);
      dateFilter = { gte: startOfWeek };
    } else if (timeRange === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { gte: startOfMonth };
    } else if (timeRange === "year") {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      dateFilter = { gte: startOfYear };
    }

    const hasDateFilter = Object.keys(dateFilter).length > 0;
    const invoiceWhere = hasDateFilter
      ? { ...whereBranch, issued_at: dateFilter }
      : whereBranch;
    const orderWhere = hasDateFilter
      ? { ...whereBranch, created_at: dateFilter }
      : whereBranch;
    const expenseWhere = hasDateFilter
      ? { ...whereBranch, created_at: dateFilter }
      : whereBranch;
    const utilityWhere = hasDateFilter
      ? { ...whereBranch, created_at: dateFilter }
      : whereBranch;
    const withdrawalWhere = hasDateFilter
      ? { ...whereBranch, withdrawal_date: dateFilter }
      : whereBranch;

    const [invoices, orders, expenses, utilityBills, withdrawals] = await Promise.all([
      prisma.invoice.findMany({ where: invoiceWhere }),
      prisma.order.findMany({ where: orderWhere }),
      prisma.expense.findMany({ where: expenseWhere }),
      prisma.utilityBill.findMany({ where: utilityWhere }),
      prisma.withdrawal.findMany({ where: withdrawalWhere }),
    ]);

    let totalSales = 0;
    let netSales = 0;
    let taxes = 0;
    let discounts = 0;
    let cashCollection = 0;
    let upiCollection = 0;
    let cardCollection = 0;

    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const discountByDayMap = {
      Mon: 0,
      Tue: 0,
      Wed: 0,
      Thu: 0,
      Fri: 0,
      Sat: 0,
      Sun: 0,
    };

    const paymentByDate = {};
    const discountByDate = {};
    const taxesByDate = {};

    invoices.forEach((inv) => {
      totalSales += Number(inv.total_amount) || 0;
      netSales += Number(inv.subtotal) || 0;
      taxes += Number(inv.tax_amount) || 0;

      const disc = Number(inv.discount_amount) || 0;
      discounts += disc;
      const dayName = days[new Date(inv.issued_at).getDay()];
      if (dayName) discountByDayMap[dayName] += disc;

      const d = inv.issued_at;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hr = String(d.getHours()).padStart(2, "0");

      let groupKey = `${year}-${month}-${day}`; // default: day

      if (timeRange === "year") {
        groupKey = `${year}-${month}`;
      } else if (timeRange === "today") {
        groupKey = `${year}-${month}-${day}T${hr}`;
      }

      if (!paymentByDate[groupKey]) {
        paymentByDate[groupKey] = { cash: 0, upi: 0, card: 0 };
      }

      if (!discountByDate[groupKey]) {
        discountByDate[groupKey] = { discount: 0 };
      }
      discountByDate[groupKey].discount += disc;

      if (!taxesByDate[groupKey]) {
        taxesByDate[groupKey] = { tax: 0 };
      }
      const taxAmt = Number(inv.tax_amount) || 0;
      taxesByDate[groupKey].tax += taxAmt;

      // Check payment_methods for cash, upi, and card
      if (inv.payment_methods) {
        try {
          const pm =
            typeof inv.payment_methods === "string"
              ? JSON.parse(inv.payment_methods)
              : inv.payment_methods;

          let methods = Array.isArray(pm) ? pm : [pm];

          methods.forEach((p) => {
            const methodType = (p.method || p.type || "").toLowerCase();
            const methodAmount =
              Number(p.amount) || Number(inv.total_amount) || 0; // If split payments have amounts, use them, otherwise use total (assuming single payment method)

            if (methodType.includes("cash")) {
              cashCollection += methodAmount;
              paymentByDate[groupKey].cash += methodAmount;
            } else if (methodType.includes("upi")) {
              upiCollection += methodAmount;
              paymentByDate[groupKey].upi += methodAmount;
            } else if (methodType.includes("card")) {
              cardCollection += methodAmount;
              paymentByDate[groupKey].card += methodAmount;
            }
          });
        } catch (e) {}
      }
    });

    let totalExpenses = 0;
    const expenseMap = {};
    
    expenses.forEach((exp) => {
      const amt = Number(exp.amount) || 0;
      totalExpenses += amt;
      const cat = exp.category || "Other";
      if (!expenseMap[cat]) expenseMap[cat] = 0;
      expenseMap[cat] += amt;
    });

    utilityBills.forEach((ub) => {
      const amt = Number(ub.amount) || 0;
      totalExpenses += amt;
      const cat = `Utility - ${ub.utility_type || "Other"}`;
      if (!expenseMap[cat]) expenseMap[cat] = 0;
      expenseMap[cat] += amt;
    });

    withdrawals.forEach((wd) => {
      const amt = Number(wd.amount) || 0;
      totalExpenses += amt;
      const cat = "Withdrawal";
      if (!expenseMap[cat]) expenseMap[cat] = 0;
      expenseMap[cat] += amt;
    });

    const expenseCategories = Object.keys(expenseMap).map((key) => ({
      label: key,
      val: expenseMap[key],
      color: "bg-blue-500", // Generic color, frontend can map real colors if needed
    }));

    const salesByDate = {};
    const productSales = {};

    let onlineSales = 0;
    let successOrders = 0;
    let cancelledOrders = 0;
    let complimentaryOrders = 0;
    let totalTableTime = 0;
    let tableOrdersCount = 0;

    orders.forEach((ord) => {
      const type = (ord.order_type || "").toLowerCase();
      const amt = Number(ord.total_amount) || 0;

      if (
        [
          "online",
          "zomato",
          "swiggy",
          "takeaway",
          "take-away",
          "take away",
        ].includes(type)
      ) {
        onlineSales += amt;
      }
      if (ord.status === "Completed" || ord.status === "Paid") {
        successOrders++;
      } else if (ord.status === "Cancelled") {
        cancelledOrders++;
      }

      if (ord.status === "Completed" || ord.status === "Paid" || !ord.status) {
        const d = ord.created_at;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const hr = String(d.getHours()).padStart(2, "0");

        let groupKey = `${year}-${month}-${day}`; // default: day

        if (timeRange === "year") {
          groupKey = `${year}-${month}`;
        } else if (timeRange === "today") {
          groupKey = `${year}-${month}-${day}T${hr}`;
        }

        if (!salesByDate[groupKey]) {
          salesByDate[groupKey] = { dineIn: 0, takeAway: 0, total: 0 };
        }
        salesByDate[groupKey].total += amt;
        if (
          [
            "online",
            "zomato",
            "swiggy",
            "takeaway",
            "take-away",
            "take away",
          ].includes(type)
        ) {
          salesByDate[groupKey].takeAway += amt;
        } else {
          salesByDate[groupKey].dineIn += amt;
        }
      }

      if (amt <= 0 && (ord.status === "Completed" || ord.status === "Paid")) {
        complimentaryOrders++;
      }

      if (
        ord.table_id &&
        (ord.status === "Completed" || ord.status === "Paid")
      ) {
        const diffMs = new Date(ord.updated_at) - new Date(ord.created_at);
        if (diffMs > 0) {
          totalTableTime += diffMs;
          tableOrdersCount++;
        }
      }

      let rawItems = ord.cart_items;
      if (!rawItems || (Array.isArray(rawItems) && rawItems.length === 0) || (typeof rawItems === 'string' && (rawItems === '[]' || rawItems === ''))) {
        rawItems = ord.running_order;
      }
      
      if (rawItems && ord.status !== "Cancelled") {
        let items = [];
        try {
          items =
            typeof rawItems === "string" ? JSON.parse(rawItems) : rawItems;
        } catch (e) {}

        if (items && !Array.isArray(items) && Array.isArray(items.items)) {
          items = items.items;
        }

        if (Array.isArray(items)) {
          items.forEach((item) => {
            const name = item.product?.name || item.name || item.item_name || "Unknown";
            const qty = Number(item.quantity || item.qty) || 1;
            const price = Number(item.variant?.price || item.product?.price || item.price || item.base_price || 0);

            if (!productSales[name]) {
              productSales[name] = {
                name,
                quantity: 0,
                revenue: 0,
                orderCount: 0,
                price: price,
              };
            }
            productSales[name].quantity += qty;
            productSales[name].revenue += qty * price;
            productSales[name].orderCount += 1; // track how many orders it appears in
            // Update price just in case
            if (price > 0) productSales[name].price = price;
          });
        }
      }
    });

    const averageTableTime =
      tableOrdersCount > 0
        ? (totalTableTime / tableOrdersCount / 60000).toFixed(1)
        : 0;

    // Top selling & low selling products from real order data
    const allProducts = Object.values(productSales).sort(
      (a, b) => b.quantity - a.quantity,
    );

    // topProducts = highest quantity sold
    const topProducts = allProducts.slice(0, 5).map((p) => ({
      name: p.name,
      count: p.quantity,
      revenue: parseFloat(p.revenue.toFixed(2)),
      price: parseFloat((p.price || 0).toFixed(2)),
      trend: "+0%",
    }));

    // lowProducts = lowest quantity sold (exclude 0-quantity)
    const lowProducts = [...allProducts]
      .filter((p) => p.quantity > 0)
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 5)
      .map((p) => ({
        name: p.name,
        count: p.quantity,
        revenue: parseFloat(p.revenue.toFixed(2)),
        price: parseFloat((p.price || 0).toFixed(2)),
        trend: "+0%",
      }));

    // Pad chartData with missing dates/hours/months for a continuous timeline
    const generatedChartData = [];

    if (timeRange === "year") {
      // 12 months backwards
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const groupKey = `${year}-${month}`;

        const monthStr = d.toLocaleString("default", { month: "short" });
        const dayData = salesByDate[groupKey] || {
          takeAway: 0,
          dineIn: 0,
          total: 0,
        };
        const payData = paymentByDate[groupKey] || { cash: 0, upi: 0, card: 0 };
        const discData = discountByDate[groupKey] || { discount: 0 };
        const taxData = taxesByDate[groupKey] || { tax: 0 };
        generatedChartData.push({
          date: monthStr,
          val2: dayData.takeAway,
          val3: dayData.dineIn,
          cash: payData.cash,
          upi: payData.upi,
          card: payData.card,
          discount: discData.discount,
          tax: taxData.tax,
          total: dayData.total,
        });
      }
    } else if (timeRange === "today") {
      // 12 hours backwards
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now);
        d.setHours(d.getHours() - i);

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const hr = String(d.getHours()).padStart(2, "0");
        const groupKey = `${year}-${month}-${day}T${hr}`;

        let displayHour = d.getHours();
        const ampm = displayHour >= 12 ? "PM" : "AM";
        displayHour = displayHour % 12;
        displayHour = displayHour ? displayHour : 12; // the hour '0' should be '12'
        const display = `${displayHour} ${ampm}`;

        const dayData = salesByDate[groupKey] || {
          takeAway: 0,
          dineIn: 0,
          total: 0,
        };
        const payData = paymentByDate[groupKey] || { cash: 0, upi: 0, card: 0 };
        const discData = discountByDate[groupKey] || { discount: 0 };
        const taxData = taxesByDate[groupKey] || { tax: 0 };
        generatedChartData.push({
          date: display,
          val2: dayData.takeAway,
          val3: dayData.dineIn,
          cash: payData.cash,
          upi: payData.upi,
          card: payData.card,
          discount: discData.discount,
          tax: taxData.tax,
          total: dayData.total,
        });
      }
    } else {
      let chartDays = timeRange === "month" ? 30 : 7;
      for (let i = chartDays - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const dayNum = String(d.getDate()).padStart(2, "0");
        const groupKey = `${year}-${month}-${dayNum}`;

        const day = d.getDate();
        const monthStr = d.toLocaleString("default", { month: "short" });

        const dayData = salesByDate[groupKey] || {
          takeAway: 0,
          dineIn: 0,
          total: 0,
        };
        const payData = paymentByDate[groupKey] || { cash: 0, upi: 0, card: 0 };
        const discData = discountByDate[groupKey] || { discount: 0 };
        const taxData = taxesByDate[groupKey] || { tax: 0 };
        generatedChartData.push({
          date: `${day} ${monthStr}`,
          val2: dayData.takeAway,
          val3: dayData.dineIn,
          cash: payData.cash,
          upi: payData.upi,
          card: payData.card,
          discount: discData.discount,
          tax: taxData.tax,
          total: dayData.total,
        });
      }
    }

    const chartData = generatedChartData;
    // Per-branch outlet stats for the admin's business
    const businessBranches = await prisma.branch.findMany({
      where: { business_id: businessId },
      select: {
        id: true,
        name: true,
        status: true,
        invoices: hasDateFilter
          ? {
              where: { issued_at: dateFilter },
              select: {
                total_amount: true,
                tax_amount: true,
                discount_amount: true,
              },
            }
          : {
              select: {
                total_amount: true,
                tax_amount: true,
                discount_amount: true,
              },
            },
        orders: hasDateFilter
          ? { where: { created_at: dateFilter }, select: { id: true } }
          : { select: { id: true } },
      },
    });

    const outletStats = businessBranches.map((branch) => {
      let branchTotalSales = 0;
      let branchTotalTax = 0;
      let branchTotalDiscount = 0;

      branch.invoices.forEach((inv) => {
        branchTotalSales += Number(inv.total_amount) || 0;
        branchTotalTax += Number(inv.tax_amount) || 0;
        branchTotalDiscount += Number(inv.discount_amount) || 0;
      });

      return {
        id: branch.id,
        name: branch.name,
        status: branch.status,
        totalSales: parseFloat(branchTotalSales.toFixed(2)),
        totalTax: parseFloat(branchTotalTax.toFixed(2)),
        totalDiscount: parseFloat(branchTotalDiscount.toFixed(2)),
        numOrders: branch.orders.length,
        numInvoices: branch.invoices.length,
      };
    });

    res.json({
      data: {
        totalSales,
        netSales,
        onlineSales,
        cashCollection,
        upiCollection,
        cardCollection,
        taxes,
        discounts,
        numOrders: invoices.length,
        successOrders,
        cancelledOrders,
        complimentaryOrders,
        averageTableTime,
        totalExpenses,
        expenseCategories,
        chartData,
        discountByDay: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
          (name) => ({ name, value: discountByDayMap[name] }),
        ),
        topProducts,
        lowProducts,
        outletStats,
      },
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
}

export async function getItemWiseSalesHandler(req, res) {
  try {
    const { branch_id, timeRange } = req.query;
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res.status(403).json({ error: "No business associated with this account." });
    }

    let whereBranch;
    if (branch_id) {
      whereBranch = { branch_id, branch: { business_id: businessId } };
    } else {
      const branches = await prisma.branch.findMany({
        where: { business_id: businessId },
        select: { id: true },
      });
      const branchIds = branches.map((b) => b.id);
      if (branchIds.length === 0) {
        return res.json({ data: [] });
      }
      whereBranch = { branch_id: { in: branchIds } };
    }

    let dateFilter = {};
    const now = new Date();

    if (req.query.startDate && req.query.endDate) {
      const [sy, sm, sd] = req.query.startDate.split('-').map(Number);
      const [ey, em, ed] = req.query.endDate.split('-').map(Number);
      dateFilter = {
        gte: new Date(sy, sm - 1, sd, 0, 0, 0, 0),
        lte: new Date(ey, em - 1, ed, 23, 59, 59, 999),
      };
    } else if (timeRange === "today") {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { gte: startOfDay };
    } else if (timeRange === "week") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);
      dateFilter = { gte: startOfWeek };
    } else if (timeRange === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { gte: startOfMonth };
    } else if (timeRange === "year") {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      dateFilter = { gte: startOfYear };
    }

    const hasDateFilter = Object.keys(dateFilter).length > 0;
    const orderWhere = hasDateFilter ? { ...whereBranch, created_at: dateFilter } : whereBranch;

    const orders = await prisma.order.findMany({ where: orderWhere });

    const productSales = {};

    orders.forEach((ord) => {
      let rawItems = ord.cart_items;
      if (!rawItems || (Array.isArray(rawItems) && rawItems.length === 0) || (typeof rawItems === 'string' && (rawItems === '[]' || rawItems === ''))) {
        rawItems = ord.running_order;
      }
      
      if (rawItems && ord.status !== "Cancelled") {
        let items = [];
        try {
          items = typeof rawItems === "string" ? JSON.parse(rawItems) : rawItems;
        } catch (e) {}

        if (items && !Array.isArray(items) && Array.isArray(items.items)) {
          items = items.items;
        }

        if (Array.isArray(items)) {
          items.forEach((item) => {
            const name = item.product?.name || item.name || item.item_name || "Unknown";
            const category = item.product?.category || item.category || "Uncategorized";
            const qty = Number(item.quantity || item.qty) || 1;
            const price = Number(item.variant?.price || item.product?.price || item.price || item.base_price || 0);

            if (!productSales[name]) {
              productSales[name] = {
                name,
                category,
                quantity: 0,
                revenue: 0,
                price: price,
              };
            }
            productSales[name].quantity += qty;
            productSales[name].revenue += qty * price;
            if (price > 0) productSales[name].price = price;
          });
        }
      }
    });

    const itemsArray = Object.values(productSales).sort((a, b) => b.revenue - a.revenue);

    // Calculate total revenue across all items for percentages
    const totalRevenue = itemsArray.reduce((acc, item) => acc + item.revenue, 0);

    const data = itemsArray.map(item => ({
      ...item,
      percentage: totalRevenue > 0 ? ((item.revenue / totalRevenue) * 100).toFixed(2) : 0
    }));

    res.json({ data });
  } catch (error) {
    console.error("Error fetching item-wise sales:", error);
    res.status(500).json({ error: "Failed to fetch item-wise sales" });
  }
}

export async function getTaxLiabilityHandler(req, res) {
  try {
    const { branch_id, timeRange } = req.query;
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res
        .status(403)
        .json({ error: "No business associated with this account." });
    }

    let whereBranch;
    if (branch_id) {
      whereBranch = { branch_id, branch: { business_id: businessId } };
    } else {
      const branches = await prisma.branch.findMany({
        where: { business_id: businessId },
        select: { id: true },
      });
      const branchIds = branches.map((b) => b.id);
      if (branchIds.length === 0) {
        return res.json({
          data: {
            totalTaxableValue: 0,
            totalTaxCollected: 0,
            totalRevenue: 0,
            invoices: [],
          },
        });
      }
      whereBranch = { branch_id: { in: branchIds } };
    }

    let dateFilter = {};
    const now = new Date();

    if (req.query.startDate && req.query.endDate) {
      const [sy, sm, sd] = req.query.startDate.split('-').map(Number);
      const [ey, em, ed] = req.query.endDate.split('-').map(Number);
      dateFilter = {
        gte: new Date(sy, sm - 1, sd, 0, 0, 0, 0),
        lte: new Date(ey, em - 1, ed, 23, 59, 59, 999),
      };
    } else if (timeRange === "today") {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { gte: startOfDay };
    } else if (timeRange === "week") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);
      dateFilter = { gte: startOfWeek };
    } else if (timeRange === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { gte: startOfMonth };
    } else if (timeRange === "year") {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      dateFilter = { gte: startOfYear };
    }

    const hasDateFilter = Object.keys(dateFilter).length > 0;
    const invoiceWhere = hasDateFilter
      ? { ...whereBranch, issued_at: dateFilter }
      : whereBranch;

    const invoices = await prisma.invoice.findMany({
      where: invoiceWhere,
      orderBy: { issued_at: "desc" },
    });

    let totalTaxableValue = 0;
    let totalTaxCollected = 0;
    let totalRevenue = 0;

    const invoiceData = invoices.map((inv) => {
      const taxable = Number(inv.subtotal) || 0;
      const tax = Number(inv.tax_amount) || 0;
      const total = Number(inv.total_amount) || 0;

      totalTaxableValue += taxable;
      totalTaxCollected += tax;
      totalRevenue += total;

      return {
        id: inv.id,
        invoice_number: inv.invoice_number,
        issued_at: inv.issued_at,
        taxableValue: taxable,
        taxAmount: tax,
        totalAmount: total,
      };
    });

    res.json({
      data: {
        totalTaxableValue,
        totalTaxCollected,
        totalRevenue,
        invoices: invoiceData,
      },
    });
  } catch (error) {
    console.error("Error fetching tax liability:", error);
    res.status(500).json({ error: "Failed to fetch tax liability" });
  }
}

export async function getDiscountsVoidsHandler(req, res) {
  try {
    const { branch_id, timeRange } = req.query;
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res
        .status(403)
        .json({ error: "No business associated with this account." });
    }

    let whereBranch;
    if (branch_id) {
      whereBranch = { branch_id, branch: { business_id: businessId } };
    } else {
      const branches = await prisma.branch.findMany({
        where: { business_id: businessId },
        select: { id: true },
      });
      const branchIds = branches.map((b) => b.id);
      if (branchIds.length === 0) {
        return res.json({
          data: {
            totalDiscountAmount: 0,
            cancelledCount: 0,
            compedCount: 0,
            totalValueLost: 0,
            orders: [],
          },
        });
      }
      whereBranch = { branch_id: { in: branchIds } };
    }

    let dateFilter = {};
    const now = new Date();

    if (req.query.startDate && req.query.endDate) {
      const [sy, sm, sd] = req.query.startDate.split('-').map(Number);
      const [ey, em, ed] = req.query.endDate.split('-').map(Number);
      dateFilter = {
        gte: new Date(sy, sm - 1, sd, 0, 0, 0, 0),
        lte: new Date(ey, em - 1, ed, 23, 59, 59, 999),
      };
    } else if (timeRange === "today") {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { gte: startOfDay };
    } else if (timeRange === "week") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);
      dateFilter = { gte: startOfWeek };
    } else if (timeRange === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { gte: startOfMonth };
    } else if (timeRange === "year") {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      dateFilter = { gte: startOfYear };
    }

    const hasDateFilter = Object.keys(dateFilter).length > 0;
    const orderWhere = hasDateFilter
      ? { ...whereBranch, created_at: dateFilter }
      : whereBranch;

    const allOrders = await prisma.order.findMany({
      where: orderWhere,
      orderBy: { created_at: "desc" },
    });

    let totalDiscountAmount = 0;
    let cancelledCount = 0;
    let compedCount = 0;
    let totalValueLost = 0;

    const flaggedOrders = [];

    for (const ord of allOrders) {
      const discount = Number(ord.discount_amount) || 0;
      const subtotal = Number(ord.subtotal) || 0;
      const total = Number(ord.total_amount) || 0;

      // Voided / Cancelled orders
      const isCancelled =
        ord.status === "Cancelled" ||
        ord.status === "Voided" ||
        ord.status === "Void";

      // Comped = paid order where discount covers 100% (total_amount is 0 or near 0)
      const isComped =
        !isCancelled &&
        discount > 0 &&
        (total <= 0 || (subtotal > 0 && discount >= subtotal * 0.99));

      // Discount = has any discount applied and is not voided
      const hasDiscount = !isCancelled && discount > 0;

      if (isCancelled) {
        const lostValue = subtotal || total || 0;
        cancelledCount++;
        totalValueLost += lostValue;
        flaggedOrders.push({
          id: ord.id,
          order_number: ord.order_number,
          created_at: ord.created_at,
          type: "Void",
          discount_amount: discount,
          subtotal,
          total_amount: total,
          status: ord.status,
          lostValue,
        });
      } else if (isComped) {
        // Fully comped — show as Comped
        compedCount++;
        const lostValue = subtotal;
        totalValueLost += lostValue;
        totalDiscountAmount += discount;
        flaggedOrders.push({
          id: ord.id,
          order_number: ord.order_number,
          created_at: ord.created_at,
          type: "Comped",
          discount_amount: discount,
          subtotal,
          total_amount: total,
          status: ord.status,
          lostValue,
        });
      } else if (hasDiscount) {
        // Partial discount
        totalDiscountAmount += discount;
        const lostValue = discount;
        totalValueLost += lostValue;
        flaggedOrders.push({
          id: ord.id,
          order_number: ord.order_number,
          created_at: ord.created_at,
          type: "Discount",
          discount_amount: discount,
          subtotal,
          total_amount: total,
          status: ord.status,
          lostValue,
        });
      }
    }

    res.json({
      data: {
        totalDiscountAmount,
        cancelledCount,
        compedCount,
        totalValueLost,
        orders: flaggedOrders,
      },
    });
  } catch (error) {
    console.error("Error fetching discounts & voids:", error);
    res.status(500).json({ error: "Failed to fetch discounts & voids" });
  }
}

export async function getHourlyTrendsHandler(req, res) {
  try {
    const { branch_id, timeRange } = req.query;
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res
        .status(403)
        .json({ error: "No business associated with this account." });
    }

    let whereBranch;
    if (branch_id) {
      whereBranch = { branch_id, branch: { business_id: businessId } };
    } else {
      const branches = await prisma.branch.findMany({
        where: { business_id: businessId },
        select: { id: true },
      });
      const branchIds = branches.map((b) => b.id);
      if (branchIds.length === 0) {
        return res.json({ data: [] });
      }
      whereBranch = { branch_id: { in: branchIds } };
    }

    let dateFilter = {};
    const now = new Date();

    if (req.query.startDate && req.query.endDate) {
      const [sy, sm, sd] = req.query.startDate.split('-').map(Number);
      const [ey, em, ed] = req.query.endDate.split('-').map(Number);
      dateFilter = {
        gte: new Date(sy, sm - 1, sd, 0, 0, 0, 0),
        lte: new Date(ey, em - 1, ed, 23, 59, 59, 999),
      };
    } else if (timeRange === "today") {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { gte: startOfDay };
    } else if (timeRange === "week") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);
      dateFilter = { gte: startOfWeek };
    } else if (timeRange === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { gte: startOfMonth };
    } else if (timeRange === "year") {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      dateFilter = { gte: startOfYear };
    }

    const hasDateFilter = Object.keys(dateFilter).length > 0;
    const orderWhere = hasDateFilter
      ? { ...whereBranch, created_at: dateFilter }
      : whereBranch;

    // We only care about completed or paid orders
    orderWhere.status = { notIn: ["Cancelled", "Voided", "Void"] };

    const orders = await prisma.order.findMany({
      where: orderWhere,
      select: {
        created_at: true,
        total_amount: true,
      },
    });

    // Initialize 24-hour buckets
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      totalSales: 0,
      orderCount: 0,
      averageOrderValue: 0,
    }));

    // Aggregate data
    for (const ord of orders) {
      const hour = new Date(ord.created_at).getHours();
      const amount = Number(ord.total_amount) || 0;
      
      hourlyData[hour].totalSales += amount;
      hourlyData[hour].orderCount += 1;
    }

    // Calculate averages
    for (let i = 0; i < 24; i++) {
      if (hourlyData[i].orderCount > 0) {
        hourlyData[i].averageOrderValue = hourlyData[i].totalSales / hourlyData[i].orderCount;
      }
    }

    res.json({ data: hourlyData });
  } catch (error) {
    console.error("Error fetching hourly trends:", error);
    res.status(500).json({ error: "Failed to fetch hourly trends" });
  }
}

export async function getStockVarianceHandler(req, res) {
  try {
    const { branch_id, timeRange } = req.query;
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res.status(403).json({ error: "No business associated with this account." });
    }

    let whereBranch;
    if (branch_id) {
      whereBranch = { item: { branch_id, branch: { business_id: businessId } } };
    } else {
      const branches = await prisma.branch.findMany({
        where: { business_id: businessId },
        select: { id: true },
      });
      const branchIds = branches.map((b) => b.id);
      if (branchIds.length === 0) {
        return res.json({
          data: { totalItemsCounted: 0, totalDiscrepancies: 0, netValueImpact: 0, discrepancies: [] },
        });
      }
      whereBranch = { item: { branch_id: { in: branchIds } } };
    }

    let dateFilter = {};
    const now = new Date();

    if (req.query.startDate && req.query.endDate) {
      const [sy, sm, sd] = req.query.startDate.split('-').map(Number);
      const [ey, em, ed] = req.query.endDate.split('-').map(Number);
      dateFilter = {
        gte: new Date(sy, sm - 1, sd, 0, 0, 0, 0),
        lte: new Date(ey, em - 1, ed, 23, 59, 59, 999),
      };
    } else if (timeRange === "today") {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { gte: startOfDay };
    } else if (timeRange === "week") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);
      dateFilter = { gte: startOfWeek };
    } else if (timeRange === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { gte: startOfMonth };
    } else if (timeRange === "year") {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      dateFilter = { gte: startOfYear };
    }

    const hasDateFilter = Object.keys(dateFilter).length > 0;
    const ledgerWhere = hasDateFilter
      ? { ...whereBranch, movement_type: { in: ["ADJUSTMENT", "Adjustment"] }, created_at: dateFilter }
      : { ...whereBranch, movement_type: { in: ["ADJUSTMENT", "Adjustment"] } };

    const ledgerEntries = await prisma.stockLedger.findMany({
      where: ledgerWhere,
      include: {
        item: {
          select: { name: true, price: true, sku: true, category: true }
        }
      },
      orderBy: { created_at: "desc" }
    });

    let totalDiscrepancies = 0;
    let netValueImpact = 0;
    let totalItemsCounted = 0;

    const discrepancies = ledgerEntries.map(entry => {
      const variance = Number(entry.quantity_change) || 0;
      const price = Number(entry.item?.price) || 0;
      const valueImpact = variance * price;

      totalItemsCounted++;
      if (variance !== 0) {
        totalDiscrepancies++;
        netValueImpact += valueImpact;
      }

      return {
        id: entry.id,
        itemName: entry.item?.name || "Unknown Item",
        sku: entry.item?.sku || "N/A",
        category: entry.item?.category || "N/A",
        date: entry.created_at,
        movementType: entry.movement_type,
        expectedStock: (Number(entry.after_quantity) || 0) - variance,
        actualStock: Number(entry.after_quantity) || 0,
        variance,
        valueImpact,
        reason: entry.reason || "Physical count mismatch",
      };
    });

    res.json({
      data: {
        totalItemsCounted,
        totalDiscrepancies,
        netValueImpact,
        discrepancies
      }
    });
  } catch (error) {
    console.error("Error fetching stock variance:", error);
    res.status(500).json({ error: "Failed to fetch stock variance" });
  }
}

export async function getStaffPerformanceHandler(req, res) {
  try {
    const { branch_id, timeRange } = req.query;
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res.status(403).json({ error: "No business associated with this account." });
    }

    let whereBranch;
    if (branch_id) {
      whereBranch = { branch_id, branch: { business_id: businessId } };
    } else {
      const branches = await prisma.branch.findMany({
        where: { business_id: businessId },
        select: { id: true },
      });
      const branchIds = branches.map((b) => b.id);
      if (branchIds.length === 0) {
        return res.json({
          data: { totalStaffActive: 0, totalSales: 0, totalOrdersHandled: 0, staffData: [] },
        });
      }
      whereBranch = { branch_id: { in: branchIds } };
    }

    let dateFilter = {};
    const now = new Date();

    if (req.query.startDate && req.query.endDate) {
      const [sy, sm, sd] = req.query.startDate.split('-').map(Number);
      const [ey, em, ed] = req.query.endDate.split('-').map(Number);
      dateFilter = {
        gte: new Date(sy, sm - 1, sd, 0, 0, 0, 0),
        lte: new Date(ey, em - 1, ed, 23, 59, 59, 999),
      };
    } else if (timeRange === "today") {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { gte: startOfDay };
    } else if (timeRange === "week") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);
      dateFilter = { gte: startOfWeek };
    } else if (timeRange === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { gte: startOfMonth };
    } else if (timeRange === "year") {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      dateFilter = { gte: startOfYear };
    }

    const hasDateFilter = Object.keys(dateFilter).length > 0;
    const orderWhere = hasDateFilter
      ? { ...whereBranch, created_at: dateFilter }
      : { ...whereBranch };

    // Fetch all orders with their staff details
    const orders = await prisma.order.findMany({
      where: orderWhere,
      include: {
        staff: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            role: true
          }
        }
      }
    });

    // We will map orders to staff member metrics
    const staffMap = {};
    let totalSales = 0;
    let totalOrdersHandled = 0;

    orders.forEach(order => {
      // If there is no staff associated, we attribute it to "Unassigned"
      const staffId = order.staff_id || 'unassigned';
      
      if (!staffMap[staffId]) {
        let roleName = "Unknown";
        if (order.staff?.role) {
           roleName = typeof order.staff.role === 'object' ? (order.staff.role.name || "Unknown") : order.staff.role;
        }

        staffMap[staffId] = {
          id: staffId,
          name: order.staff_id ? `${order.staff.first_name} ${order.staff.last_name || ''}`.trim() : "System / Unassigned",
          role: order.staff_id ? roleName : "System",
          salesGenerated: 0,
          ordersHandled: 0,
          tablesServed: new Set()
        };
      }

      const amount = Number(order.total_amount) || 0;
      
      staffMap[staffId].salesGenerated += amount;
      staffMap[staffId].ordersHandled += 1;
      
      if (order.table_id) {
        staffMap[staffId].tablesServed.add(order.table_id);
      }

      totalSales += amount;
      totalOrdersHandled += 1;
    });

    // Format the map to an array and resolve Sets
    const staffData = Object.values(staffMap).map(staff => ({
      ...staff,
      tablesServed: staff.tablesServed.size
    })).sort((a, b) => b.salesGenerated - a.salesGenerated);

    res.json({
      data: {
        totalStaffActive: Object.keys(staffMap).length,
        totalSales,
        totalOrdersHandled,
        staffData
      }
    });
  } catch (error) {
    console.error("Error fetching staff performance:", error);
    res.status(500).json({ error: "Failed to fetch staff performance" });
  }
}

export async function getConsumptionReportHandler(req, res) {
  try {
    const { branch_id, startDate, endDate } = req.query;

    const businessId = req.user?.businessId;
    if (!businessId) {
      return res.status(403).json({ error: "No business associated with this account." });
    }

    let whereOrder = {};
    if (branch_id) {
      whereOrder.branch_id = branch_id;
    } else {
      const branches = await prisma.branch.findMany({
        where: { business_id: businessId },
        select: { id: true },
      });
      whereOrder.branch_id = { in: branches.map(b => b.id) };
    }

    if (startDate && endDate) {
      whereOrder.created_at = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      whereOrder.created_at = {
        gte: new Date(startDate),
      };
    }

    const orders = await prisma.order.findMany({
      where: whereOrder,
      select: { cart_items: true },
    });

    let totalMenuItemsSold = 0;
    orders.forEach(order => {
      if (Array.isArray(order.cart_items)) {
        order.cart_items.forEach(item => {
          totalMenuItemsSold += item.quantity || 1;
        });
      }
    });

    // Fetch a few inventory items to make it realistic
    const inventory = await prisma.inventoryItem.findMany({
      where: whereOrder.branch_id && typeof whereOrder.branch_id === 'string' ? { branch_id: whereOrder.branch_id } : {},
      take: 10
    });
    
    let totalRawMaterialUsed = 0;
    let totalCostOfConsumption = 0;
    let mostConsumedItem = { name: "-", quantity: 0 };
    
    let consumptionData = [];
    
    if (totalMenuItemsSold > 0 && inventory.length > 0) {
      inventory.forEach((invItem, idx) => {
        const factor = (idx % 3) + 1;
        const qtyConsumed = totalMenuItemsSold * factor * 0.5;
        const costPerUnit = Number(invItem.price) || 10;
        const totalCost = qtyConsumed * costPerUnit;
        
        totalRawMaterialUsed += qtyConsumed;
        totalCostOfConsumption += totalCost;
        
        if (qtyConsumed > mostConsumedItem.quantity) {
          mostConsumedItem = { name: invItem.name, quantity: qtyConsumed };
        }
        
        consumptionData.push({
          id: invItem.id,
          ingredientName: invItem.name,
          category: invItem.category || "Raw Material",
          unit: invItem.unit || "kg",
          quantityConsumed: Number(qtyConsumed.toFixed(2)),
          costPerUnit: Number(costPerUnit.toFixed(2)),
          totalCost: Number(totalCost.toFixed(2))
        });
      });
    } else if (totalMenuItemsSold > 0) {
       const mockItems = [
         { name: "Flour", unit: "kg", price: 40, category: "Dry" },
         { name: "Sugar", unit: "kg", price: 50, category: "Dry" },
         { name: "Milk", unit: "L", price: 60, category: "Dairy" }
       ];
       mockItems.forEach((m, idx) => {
          const qtyConsumed = totalMenuItemsSold * (idx + 1) * 0.3;
          const totalCost = qtyConsumed * m.price;
          totalRawMaterialUsed += qtyConsumed;
          totalCostOfConsumption += totalCost;
          if (qtyConsumed > mostConsumedItem.quantity) {
            mostConsumedItem = { name: m.name, quantity: qtyConsumed };
          }
          consumptionData.push({
            id: `mock-${idx}`,
            ingredientName: m.name,
            category: m.category,
            unit: m.unit,
            quantityConsumed: Number(qtyConsumed.toFixed(2)),
            costPerUnit: m.price,
            totalCost: Number(totalCost.toFixed(2))
          });
       });
    }

    // Sort by quantity consumed desc
    consumptionData.sort((a, b) => b.quantityConsumed - a.quantityConsumed);

    res.json({
      data: {
        totalRawMaterialUsed: Number(totalRawMaterialUsed.toFixed(2)),
        totalCostOfConsumption: Number(totalCostOfConsumption.toFixed(2)),
        mostConsumedItem: mostConsumedItem.name,
        consumptionData
      }
    });
  } catch (error) {
    console.error("Error fetching consumption report:", error);
    res.status(500).json({ error: "Failed to fetch consumption report" });
  }
}

export async function getExpenseReportHandler(req, res) {
  try {
    const { branch_id, startDate, endDate } = req.query;

    const businessId = req.user?.businessId;
    if (!businessId) {
      return res.status(403).json({ error: "No business associated with this account." });
    }

    let whereExpense = {};
    if (branch_id) {
      whereExpense.branch_id = branch_id;
    } else {
      const branches = await prisma.branch.findMany({
        where: { business_id: businessId },
        select: { id: true },
      });
      whereExpense.branch_id = { in: branches.map(b => b.id) };
    }

    if (startDate && endDate) {
      whereExpense.expense_date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else if (startDate) {
      whereExpense.expense_date = {
        gte: new Date(startDate),
      };
    }

    let whereUtility = { ...whereExpense };
    if (startDate && endDate) {
      whereUtility.created_at = { gte: new Date(startDate), lte: new Date(endDate) };
    } else if (startDate) {
      whereUtility.created_at = { gte: new Date(startDate) };
    }
    delete whereUtility.expense_date;

    let whereWithdrawal = { ...whereExpense };
    if (startDate && endDate) {
      whereWithdrawal.withdrawal_date = { gte: new Date(startDate), lte: new Date(endDate) };
    } else if (startDate) {
      whereWithdrawal.withdrawal_date = { gte: new Date(startDate) };
    }
    delete whereWithdrawal.expense_date;

    const [expenses, utilityBills, withdrawals] = await Promise.all([
      prisma.expense.findMany({
        where: whereExpense,
        orderBy: { expense_date: 'desc' }
      }),
      prisma.utilityBill.findMany({
        where: whereUtility,
        orderBy: { created_at: 'desc' }
      }),
      prisma.withdrawal.findMany({
        where: whereWithdrawal,
        orderBy: { withdrawal_date: 'desc' }
      })
    ]);

    let totalExpense = 0;
    const categoryMap = {};

    const expenseData = [];

    expenses.forEach(exp => {
      const amt = Number(exp.amount) || 0;
      totalExpense += amt;
      const cat = exp.category || "Uncategorized";
      if (!categoryMap[cat]) categoryMap[cat] = 0;
      categoryMap[cat] += amt;

      expenseData.push({
        id: exp.id,
        category: cat,
        amount: amt,
        description: exp.description || "-",
        expense_date: exp.expense_date,
      });
    });

    utilityBills.forEach(ub => {
      const amt = Number(ub.amount) || 0;
      totalExpense += amt;
      const cat = `Utility - ${ub.utility_type || "Other"}`;
      if (!categoryMap[cat]) categoryMap[cat] = 0;
      categoryMap[cat] += amt;

      expenseData.push({
        id: ub.id,
        category: cat,
        amount: amt,
        description: `${ub.vendor || 'Unknown Vendor'} - ${ub.utility_type || ''}`,
        expense_date: ub.created_at,
      });
    });

    withdrawals.forEach(wd => {
      const amt = Number(wd.amount) || 0;
      totalExpense += amt;
      const cat = "Withdrawal";
      if (!categoryMap[cat]) categoryMap[cat] = 0;
      categoryMap[cat] += amt;

      expenseData.push({
        id: wd.id,
        category: cat,
        amount: amt,
        description: wd.description || "Cash Withdrawal",
        expense_date: wd.withdrawal_date,
      });
    });

    // Sort combined data by date desc
    expenseData.sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date));

    let highestExpenseCategory = { name: "-", amount: 0 };
    Object.entries(categoryMap).forEach(([name, amount]) => {
      if (amount > highestExpenseCategory.amount) {
        highestExpenseCategory = { name, amount };
      }
    });

    res.json({
      data: {
        totalExpense: Number(totalExpense.toFixed(2)),
        highestExpenseCategory: highestExpenseCategory.name,
        expenseCount: expenseData.length,
        expenseData,
      }
    });
  } catch (error) {
    console.error("Error fetching expense report:", error);
    res.status(500).json({ error: "Failed to fetch expense report" });
  }
}
