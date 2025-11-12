import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import { db } from "../../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

passport.use(
  new LocalStrategy(
    {
      usernameField: "username",
      passwordField: "password",
    },
    async (username, password, done) => {
      try {
        // Find user by username
        const result = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        const user = result[0];

        // User not found
        if (!user) {
          return done(null, false, { message: "Invalid username or password" });
        }

        // Check if account is locked
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          return done(null, false, { message: "Account is locked. Try again later." });
        }

        // Check if account is active
        if (!user.isActive) {
          return done(null, false, { message: "Account is disabled" });
        }

        // Check if user has a password (OAuth users might not)
        if (!user.passwordHash) {
          return done(null, false, { message: "Invalid authentication method" });
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.passwordHash);

        if (!isValid) {
          // Increment failed login attempts
          const newFailedAttempts = user.failedLoginAttempts + 1;
          const lockUntil = newFailedAttempts >= 5 
            ? new Date(Date.now() + 30 * 60 * 1000) // Lock for 30 minutes
            : null;

          await db
            .update(users)
            .set({
              failedLoginAttempts: newFailedAttempts,
              lockedUntil: lockUntil,
            })
            .where(eq(users.id, user.id));

          return done(null, false, { 
            message: lockUntil 
              ? "Too many failed attempts. Account locked for 30 minutes." 
              : "Invalid username or password" 
          });
        }

        // Successful login - reset failed attempts and update last login
        await db
          .update(users)
          .set({
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLogin: new Date(),
          })
          .where(eq(users.id, user.id));

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    done(null, result[0] || null);
  } catch (error) {
    done(error);
  }
});

export default passport;
