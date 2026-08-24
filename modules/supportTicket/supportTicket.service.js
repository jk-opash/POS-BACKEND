import { prisma } from "../../config/database.js";

// Utility to generate a unique ticket number
async function generateTicketNumber() {
  const latestTicket = await prisma.supportTicket.findFirst({
    orderBy: { created_at: 'desc' }
  });
  
  if (!latestTicket) {
    return 'TKT-1000';
  }
  
  const lastNumber = parseInt(latestTicket.ticket_number.split('-')[1]);
  return `TKT-${lastNumber + 1}`;
}

export async function createSupportTicket(data) {
  const ticket_number = await generateTicketNumber();
  return await prisma.supportTicket.create({
    data: {
      ...data,
      ticket_number
    }
  });
}

export async function getAllSupportTickets(filters = {}) {
  const { status, priority, search, business_id, branch_id } = filters;
  
  const whereClause = {};
  
  if (business_id) whereClause.business_id = business_id;
  if (branch_id) whereClause.branch_id = branch_id;
  
  if (status && status !== 'all') {
    if (status === 'open') {
      whereClause.status = { in: ['open', 'in_progress', 'escalated'] };
    } else {
      whereClause.status = status;
    }
  }
  
  if (priority && priority !== 'all') {
    whereClause.priority = priority;
  }
  
  if (search) {
    whereClause.OR = [
      { subject: { contains: search, mode: 'insensitive' } },
      { ticket_number: { contains: search, mode: 'insensitive' } },
      { business: { name: { contains: search, mode: 'insensitive' } } }
    ];
  }

  return await prisma.supportTicket.findMany({
    where: whereClause,
    include: {
      business: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true
        }
      },
      branch: {
        select: {
          id: true,
          name: true,
          code: true
        }
      }
    },
    orderBy: { created_at: 'desc' }
  });
}

export async function getSupportTicketById(id) {
  return await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true
        }
      },
      branch: {
        select: {
          id: true,
          name: true,
          code: true
        }
      }
    }
  });
}

export async function updateSupportTicket(id, data) {
  return await prisma.supportTicket.update({
    where: { id },
    data
  });
}

export async function deleteSupportTicket(id) {
  return await prisma.supportTicket.delete({
    where: { id }
  });
}
