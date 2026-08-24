import { prisma } from "../../config/database.js";

// GET /api/expense
export async function getExpensesHandler(req, res) {
  try {
    const { branch_id } = req.query;
    const whereClause = branch_id ? { branch_id } : {};
    
    const expenses = await prisma.expense.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' }
    });
    
    res.json({ data: expenses });
  } catch (error) {
    console.error("Error fetching expenses:", error);
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
}

// POST /api/expense
export async function createExpenseHandler(req, res) {
  try {
    const { branch_id, category, amount, description, expense_date } = req.body;
    
    const expense = await prisma.expense.create({
      data: {
        branch_id,
        category,
        amount,
        description,
        expense_date: expense_date ? new Date(expense_date) : new Date()
      }
    });
    
    res.status(201).json({ data: expense });
  } catch (error) {
    console.error("Error creating expense:", error);
    res.status(500).json({ error: "Failed to create expense" });
  }
}
