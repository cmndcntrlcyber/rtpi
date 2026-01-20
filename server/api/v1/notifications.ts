import { Router } from "express";
import { db } from "../../db";
import { notifications } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { ensureAuthenticated } from "../../auth/middleware";

const router = Router();

// Apply authentication to all routes
router.use(ensureAuthenticated);

// GET /api/v1/notifications - List all notifications for current user
router.get("/", async (req, res) => {
  const user = req.user as any;

  try {
    const userNotifications = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt));

    res.json({ notifications: userNotifications });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to retrieve notifications",
      details: error.message,
    });
  }
});

// GET /api/v1/notifications/unread - List unread notifications
router.get("/unread", async (req, res) => {
  const user = req.user as any;

  try {
    const unreadNotifications = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, user.id),
          eq(notifications.read, false)
        )
      )
      .orderBy(desc(notifications.createdAt));

    res.json({ notifications: unreadNotifications });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to retrieve unread notifications",
      details: error.message,
    });
  }
});

// GET /api/v1/notifications/count - Get unread notification count
router.get("/count", async (req, res) => {
  const user = req.user as any;

  try {
    const unreadNotifications = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, user.id),
          eq(notifications.read, false)
        )
      );

    res.json({ count: unreadNotifications.length });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to retrieve notification count",
      details: error.message,
    });
  }
});

// PATCH /api/v1/notifications/:id/read - Mark notification as read
router.patch("/:id/read", async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    const result = await db
      .update(notifications)
      .set({
        read: true,
        readAt: new Date(),
      })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, user.id)
        )
      )
      .returning();

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json({ notification: result[0] });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to mark notification as read",
      details: error.message,
    });
  }
});

// POST /api/v1/notifications/mark-all-read - Mark all notifications as read
router.post("/mark-all-read", async (req, res) => {
  const user = req.user as any;

  try {
    await db
      .update(notifications)
      .set({
        read: true,
        readAt: new Date(),
      })
      .where(
        and(
          eq(notifications.userId, user.id),
          eq(notifications.read, false)
        )
      );

    res.json({ message: "All notifications marked as read" });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to mark all notifications as read",
      details: error.message,
    });
  }
});

// DELETE /api/v1/notifications/:id - Delete a notification
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const user = req.user as any;

  try {
    await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, user.id)
        )
      );

    res.json({ message: "Notification deleted successfully" });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to delete notification",
      details: error.message,
    });
  }
});

// DELETE /api/v1/notifications - Clear all notifications
router.delete("/", async (req, res) => {
  const user = req.user as any;

  try {
    await db
      .delete(notifications)
      .where(eq(notifications.userId, user.id));

    res.json({ message: "All notifications cleared" });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to clear notifications",
      details: error.message,
    });
  }
});

// POST /api/v1/notifications - Create notification (internal/admin use)
router.post("/", async (req, res) => {
  const user = req.user as any;
  const { userId, type, title, message, metadata } = req.body;

  // Only allow creating notifications for yourself or if you're an admin
  if (userId && userId !== user.id && user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const notification = await db
      .insert(notifications)
      .values({
        userId: userId || user.id,
        type,
        title,
        message,
        metadata,
      })
      .returning();

    res.status(201).json({ notification: notification[0] });
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to create notification",
      details: error.message,
    });
  }
});

export default router;
