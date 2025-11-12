import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { db } from "../../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

// Check if Google OAuth is configured
const isGoogleOAuthConfigured = 
  process.env.GOOGLE_CLIENT_ID && 
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_CLIENT_ID.trim() !== '' &&
  process.env.GOOGLE_CLIENT_SECRET.trim() !== '';

// Only configure Google OAuth if credentials are provided
if (isGoogleOAuthConfigured) {
  console.log('✓ Google OAuth is configured');
  
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/api/v1/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value;
        const displayName = profile.displayName;

        if (!email) {
          return done(new Error("No email found in Google profile"));
        }

        // Check if user exists with this Google ID
        let result = await db
          .select()
          .from(users)
          .where(eq(users.googleId, googleId))
          .limit(1);

        let user = result[0];

        if (user) {
          // Update last login
          await db
            .update(users)
            .set({
              lastLogin: new Date(),
            })
            .where(eq(users.id, user.id));

          return done(null, user);
        }

        // Check if user exists with this email
        result = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        user = result[0];

        if (user) {
          // Link Google account to existing user
          await db
            .update(users)
            .set({
              googleId,
              authMethod: "google_oauth",
              lastLogin: new Date(),
            })
            .where(eq(users.id, user.id));

          const updated = await db
            .select()
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);

          return done(null, updated[0]);
        }

        // Create new user
        const newUserResult = await db
          .insert(users)
          .values({
            username: email.split("@")[0], // Use email prefix as username
            email,
            googleId,
            authMethod: "google_oauth",
            role: "operator",
            isActive: true,
            mustChangePassword: false,
            lastLogin: new Date(),
          })
          .returning();

        return done(null, newUserResult[0]);
      } catch (error) {
        return done(error as Error);
      }
    }
    )
  );
} else {
  console.log('⚠ Google OAuth is not configured - OAuth routes will be disabled');
  console.log('  To enable Google OAuth, set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
}

// Export flag to check if OAuth is available
export const isOAuthAvailable = isGoogleOAuthConfigured;
export default passport;
