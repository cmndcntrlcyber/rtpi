import { Router } from "express";
import { db } from "../../db";
import { users } from "../../../shared/schema";
import { ensureAuthenticated, ensureRole } from "../../auth/middleware";
import { eq } from "drizzle-orm";

const router = Router();

// Apply authentication - only admins can manage users
router.use(ensureAuthenticated);
router.use(ensureRole("admin"));

// GET /api/v1/users - List all users
router.get("/", async (_req, res) => {
  try {
    const allUsers = await db.select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      authMethod: users.authMethod,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
      lastLogin: users.lastLogin,
      failedLoginAttempts: users.failedLoginAttempts,
      lockedUntil: users.lockedUntil,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    }).from(users);

    res.json({ users: allUsers });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to list users", details: error?.message || "Internal server error" });
  }
});

// GET /api/v1/users/:id - Get user by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const user = await db.select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      authMethod: users.authMethod,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
      lastLogin: users.lastLogin,
      failedLoginAttempts: users.failedLoginAttempts,
      lockedUntil: users.lockedUntil,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    }).from(users).where(eq(users.id, id));

    if (user.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: user[0] });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to get user", details: error?.message || "Internal server error" });
  }
});

// PATCH /api/v1/users/:id - Update user
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { role, isActive, mustChangePassword } = req.body;

    const updateData: any = {};
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (mustChangePassword !== undefined) updateData.mustChangePassword = mustChangePassword;
    updateData.updatedAt = new Date();

    const updatedUser = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();

    if (updatedUser.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: updatedUser[0] });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to update user", details: error?.message || "Internal server error" });
  }
});

// DELETE /api/v1/users/:id - Delete user
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (req.user && req.user.id === id) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    const deletedUser = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning();

    if (deletedUser.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ success: true, message: "User deleted successfully" });
  } catch (error: any) {
    // Error logged for debugging
    res.status(500).json({ error: "Failed to delete user", details: error?.message || "Internal server error" });
  }
});

export default router;
