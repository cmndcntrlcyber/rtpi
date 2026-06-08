import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";

/**
 * Static guard against the "dead navigation link" class of bug (e.g. a
 * setLocation("/offsec-team") that points at a route registered as
 * "/offsec-rd"). Parses App.tsx for the registered routes and every
 * setLocation("literal") call under client/src, then asserts each literal
 * navigation target resolves to a real route.
 *
 * Pure file parsing — no DOM, DB, or network — so it runs reliably in CI.
 */

const CLIENT_SRC = path.resolve(__dirname, "../../../../client/src");
const APP_TSX = path.join(CLIENT_SRC, "App.tsx");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Registered route paths from App.tsx, e.g. ["/", "/offsec-rd", ...]. */
function getRegisteredRoutes(): string[] {
  const src = readFileSync(APP_TSX, "utf-8");
  const routes: string[] = [];
  const re = /<Route\s+path=["'`]([^"'`]+)["'`]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    routes.push(m[1]);
  }
  return routes;
}

/** Collect setLocation("literal") targets across the client source tree. */
function getStaticNavTargets(): Array<{ file: string; target: string }> {
  const targets: Array<{ file: string; target: string }> = [];
  for (const file of walk(CLIENT_SRC)) {
    const src = readFileSync(file, "utf-8");
    // Only string-literal navigations — template literals / variables are dynamic
    // and can't be checked statically.
    const re = /setLocation\(\s*["']([^"']+)["']\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      targets.push({ file: path.relative(CLIENT_SRC, file), target: m[1] });
    }
  }
  return targets;
}

/**
 * A registered route matches a navigation target if their path segments line up,
 * treating ":param" route segments as wildcards. The target's query string and
 * hash are ignored.
 */
function routeMatches(routePath: string, target: string): boolean {
  const cleanTarget = target.split(/[?#]/)[0];
  const routeSegs = routePath.split("/").filter(Boolean);
  const targetSegs = cleanTarget.split("/").filter(Boolean);
  if (routeSegs.length !== targetSegs.length) return false;
  return routeSegs.every((seg, i) => seg.startsWith(":") || seg === targetSegs[i]);
}

describe("client route existence", () => {
  it("registers at least the known core routes", () => {
    const routes = getRegisteredRoutes();
    expect(routes).toContain("/offsec-rd");
    expect(routes.length).toBeGreaterThan(5);
  });

  it("every setLocation() literal target maps to a registered route", () => {
    const routes = getRegisteredRoutes();
    const targets = getStaticNavTargets();

    const broken = targets.filter(
      ({ target }) => !routes.some((r) => routeMatches(r, target)),
    );

    expect(
      broken,
      `Dead navigation target(s) — no <Route> matches:\n` +
        broken.map((b) => `  ${b.file}: setLocation("${b.target}")`).join("\n"),
    ).toEqual([]);
  });
});
