import { Router } from "express";
import passport from "passport";
import bcrypt from "bcrypt";
import { db } from "../../db";
import { users, passwordHistory } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ensureAuthenticated, logAudit } from "../../auth/middleware";
import { authLimiter, passwordChangeLimiter } from "../../middleware/rate-limit";
import { generateCsrfToken } from "../../middleware/csrf";
import { isOAuthAvailable } from "../../auth/strategies/google";
import { empireExecutor } from "../../services/empire-executor";

const router = Router();

// Seed test user (development only)
if (process.env.NODE_ENV !== "production") {
  router.post("/seed-test-user", async (_req, res) => {
    try {
      const hashedPassword = await bcrypt.hash("testpass123", 10);

      const result = await db.insert(users).values({
        username: "testuser",
        email: "test@example.com",
        passwordHash: hashedPassword,
        role: "admin",
        authMethod: "local",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      // Initialize Empire tokens for the new user
      await empireExecutor.initializeTokensForUser(result[0].id);

      return res.json({
        success: true,
        message: "Test user created",
        user: {
          id: result[0].id,
          username: result[0].username,
          email: result[0].email,
        }
      });
    } catch (error: any) {
      // User might already exist
      if (error.message.includes("unique constraint")) {
        return res.json({ success: true, message: "Test user already exists" });
      }
      console.error("Error creating test user:", error);
      return res.status(500).json({ error: "Failed to create test user" });
    }
  });
}

// Get CSRF token
router.get("/csrf-token", (req, res) => {
  const token = generateCsrfToken(req);
  res.json({ csrfToken: token });
});

// Login with username/password
router.post("/login", authLimiter, (req, res, next) => {
  passport.authenticate("local", async (err: any, user: any, info: any) => {
    if (err) {
      return res.status(500).json({ error: "Authentication error" });
    }
    
    if (!user) {
      return res.status(401).json({ error: info?.message || "Invalid credentials" });
    }
    
    req.logIn(user, async (err) => {
      if (err) {
        return res.status(500).json({ error: "Login failed" });
      }
      
      await logAudit(user.id, "login", "/auth", user.id, true, req);
      
      return res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          authMethod: user.authMethod,
        },
      });
    });
  })(req, res, next);
});

// Google OAuth routes - only register if OAuth is configured
if (isOAuthAvailable) {
  // Google OAuth initiate
  router.get("/google", passport.authenticate("google", { 
    scope: ["profile", "email"] 
  }));

  // Google OAuth callback
  router.get("/google/callback",
    passport.authenticate("google", { failureRedirect: "/login" }),
    async (req, res) => {
      const user = req.user as any;
      await logAudit(user.id, "login_oauth", "/auth", user.id, true, req);
      res.redirect("/dashboard");
    }
  );
} else {
  // Return helpful error message when OAuth is not configured
  router.get("/google", (_req, res) => {
    res.status(503).json({
      error: "Google OAuth is not configured",
      message: "Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables"
    });
  });

  router.get("/google/callback", (_req, res) => {
    res.status(503).json({
      error: "Google OAuth is not configured",
      message: "Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables"
    });
  });
}

// Logout
router.post("/logout", ensureAuthenticated, async (req, res) => {
  const user = req.user as any;
  await logAudit(user.id, "logout", "/auth", user.id, true, req);
  
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    res.json({ success: true, message: "Logged out successfully" });
  });
});

// Get current user
router.get("/me", ensureAuthenticated, (req, res) => {
  const user = req.user as any;
  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      authMethod: user.authMethod,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    },
  });
});

// Change password
router.put("/password", ensureAuthenticated, passwordChangeLimiter, async (req, res) => {
  const user = req.user as any;
  const { currentPassword, newPassword } = req.body;

  try {
    // Verify current password
    if (!user.passwordHash) {
      return res.status(400).json({ 
        error: "Cannot change password for OAuth accounts" 
      });
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      await logAudit(user.id, "password_change", "/auth", user.id, false, req);
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Validate new password strength
    if (newPassword.length < 12) {
      return res.status(400).json({ 
        error: "Password must be at least 12 characters" 
      });
    }

    const hasUppercase = /[A-Z]/.test(newPassword);
    const hasLowercase = /[a-z]/.test(newPassword);
    const hasNumber = /\d/.test(newPassword);
    const hasSpecial = /[@$!%*?&]/.test(newPassword);

    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      return res.status(400).json({
        error: "Password must contain uppercase, lowercase, number, and special character",
      });
    }

    // Check password history (last 5 passwords)
    const history = await db
      .select()
      .from(passwordHistory)
      .where(eq(passwordHistory.userId, user.id))
      .orderBy(passwordHistory.createdAt)
      .limit(5);

    for (const old of history) {
      if (await bcrypt.compare(newPassword, old.passwordHash)) {
        return res.status(400).json({
          error: "Cannot reuse recent passwords",
        });
      }
    }

    // Hash new password
    const newHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await db
      .update(users)
      .set({
        passwordHash: newHash,
        mustChangePassword: false,
      })
      .where(eq(users.id, user.id));

    // Save to password history
    await db.insert(passwordHistory).values({
      userId: user.id,
      passwordHash: newHash,
    });

    await logAudit(user.id, "password_change", "/auth", user.id, true, req);

    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Password change error:", error);
    await logAudit(user.id, "password_change", "/auth", user.id, false, req);
    res.status(500).json({ error: "Failed to change password" });
  }
});

export default router;
