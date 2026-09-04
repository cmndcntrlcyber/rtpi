import type { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { db } from "../../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "../../lib/logger";

const log = createLogger("cloudflare-access");

const enabled =
  process.env.FF_CLOUDFLARE_ACCESS?.trim().toLowerCase() === "true" ||
  process.env.FF_CLOUDFLARE_ACCESS?.trim() === "1";

const teamDomain = process.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN?.trim();
const audTags = process.env.CLOUDFLARE_ACCESS_AUD_TAGS?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const JWKS =
  enabled && teamDomain
    ? createRemoteJWKSet(
        new URL(`https://${teamDomain}/cdn-cgi/access/certs`),
      )
    : null;

if (enabled && JWKS) {
  log.info("Cloudflare Access JWT verification enabled (team: %s)", teamDomain);
} else if (enabled) {
  log.warn(
    "FF_CLOUDFLARE_ACCESS is true but CLOUDFLARE_ACCESS_TEAM_DOMAIN is missing — middleware disabled",
  );
}

export async function verifyCloudflareJWT(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!enabled || !JWKS) return next();

  const token = req.headers["cf-access-jwt-assertion"] as string | undefined;
  if (!token) return next();

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://${teamDomain}`,
      audience: audTags && audTags.length > 0 ? audTags : undefined,
    });

    const email = payload.email as string | undefined;
    if (!email) {
      log.warn("CF JWT valid but missing email claim");
      return next();
    }

    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user) {
      await db
        .update(users)
        .set({ lastLogin: new Date(), authMethod: "cloudflare_access" })
        .where(eq(users.id, user.id));
    } else {
      const [created] = await db
        .insert(users)
        .values({
          username: email.split("@")[0],
          email,
          authMethod: "cloudflare_access",
          role: "operator",
          isActive: true,
          mustChangePassword: false,
          lastLogin: new Date(),
        })
        .returning();
      user = created;
    }

    (req as any).user = user;
    log.info("Authenticated via CF Access: %s", email);
  } catch (err) {
    log.debug({ err }, "CF JWT verification failed — falling through to Passport");
  }

  return next();
}
