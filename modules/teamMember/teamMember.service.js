import { prisma } from "../../config/database.js";
import bcrypt from "bcryptjs";

// Get all team members (optionally filter by business_id)
export async function getAllTeamMembers(businessId) {
  const query = businessId ? { where: { business_id: businessId } } : {};
  return await prisma.teamMember.findMany({
    ...query,
    include: { branch: true },
    orderBy: { created_at: "asc" },
  });
}

// Get team member by ID
export async function getTeamMemberById(id) {
  return await prisma.teamMember.findUnique({
    where: { id },
    include: { branch: true },
  });
}

// Create new team member
export async function createTeamMember(data) {
  const payload = { ...data };

  if (payload.password) {
    payload.password_hash = await bcrypt.hash(payload.password, 10);
    delete payload.password;
  }

  if (payload.salary === "") payload.salary = null;
  if (payload.branch_id === "") payload.branch_id = null;

  delete payload.name;
  delete payload.role_name;
  delete payload.permissions;
  delete payload.active;

  return await prisma.teamMember.create({
    data: payload,
    include: { branch: true },
  });
}

// Update existing team member
export async function updateTeamMember(id, data) {
  const payload = { ...data };

  if (payload.password) {
    payload.password_hash = await bcrypt.hash(payload.password, 10);
    delete payload.password;
  }

  if (payload.salary === "") payload.salary = null;
  if (payload.branch_id === "") payload.branch_id = null;

  delete payload.name;
  delete payload.role_name;
  delete payload.permissions;
  delete payload.active;

  return await prisma.teamMember.update({
    where: { id },
    data: payload,
    include: { branch: true },
  });
}

// Delete team member
export async function deleteTeamMember(id) {
  return await prisma.teamMember.delete({
    where: { id },
  });
}

export async function resetTeamMemberPassword(teamMemberId, providedPassword) {
  const teamMember = await prisma.teamMember.findUnique({
    where: { id: teamMemberId },
  });

  if (!teamMember) {
    throw new Error("Team member not found.");
  }

  // Use provided password or generate an 8-character random password
  const newPassword =
    providedPassword || require("crypto").randomBytes(4).toString("hex");
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.teamMember.update({
    where: { id: teamMemberId },
    data: { password_hash: hashedPassword },
  });

  return newPassword;
}

export async function resetTeamMemberPin(teamMemberId, providedPin) {
  const teamMember = await prisma.teamMember.findUnique({
    where: { id: teamMemberId },
  });

  if (!teamMember) {
    throw new Error("Team member not found.");
  }

  // Use provided PIN or generate a 4-digit random PIN
  const newPin =
    providedPin || Math.floor(1000 + Math.random() * 9000).toString();

  await prisma.teamMember.update({
    where: { id: teamMemberId },
    data: { pin: newPin },
  });

  return newPin;
}
