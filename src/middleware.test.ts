import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getClaims, createServerClient } = vi.hoisted(() => {
  const getClaims = vi.fn(async () => ({ data: null, error: null }));
  return { getClaims, createServerClient: vi.fn<(...args: unknown[]) => { auth: { getClaims: typeof getClaims } }>(() => ({ auth: { getClaims } })) };
});
vi.mock("@supabase/ssr", () => ({ createServerClient: (...a: unknown[]) => createServerClient(...a) }));

import { NOT_CONFIGURED } from "./lib/admin/env";
import { ROUTES, IRS_LETTER_PATH } from "./lib/routes";
import { config, middleware } from "./middleware";

const VARS = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"] as const;
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const v of VARS) saved[v] = process.env[v];
  createServerClient.mockClear();
  getClaims.mockClear();
});
afterEach(() => {
  for (const v of VARS) {
    if (saved[v] === undefined) delete process.env[v];
    else process.env[v] = saved[v];
  }
});
const setAll = () => VARS.forEach((v) => (process.env[v] = `test-${v.toLowerCase()}`));

describe("the middleware's matcher", () => {
  it("is exactly /admin/:path*", () => {
    expect(config).toEqual({ matcher: ["/admin/:path*"] });
  });

  it("matches /admin and everything under it", () => {
    for (const p of ["/admin", "/admin/sign-in", "/admin/confirm?code=x", "/admin/handovers?kind=synthetic", "/admin/items/00000000-0000-4000-8000-000000000000"]) {
      expect(unstable_doesMiddlewareMatch({ config, url: p }), p).toBe(true);
    }
  });

  it("never matches the five public routes, robots.txt, the PDF, images or look-alikes", () => {
    const paths = [...ROUTES.map((r) => r.path), "/robots.txt", IRS_LETTER_PATH, "/images/photo-1021973-640.jpg", "/administer", "/timeline#hanoi-2015", "/_next/static/x.js"];
    for (const p of paths) expect(unstable_doesMiddlewareMatch({ config, url: p }), p).toBe(false);
  });
});

describe("the middleware", () => {
  it("answers 503 not configured, with noindex and no-store, when any variable is missing", async () => {
    for (const missing of VARS) {
      setAll();
      delete process.env[missing];
      const res = await middleware(new NextRequest("http://localhost:3020/admin"));
      expect(res.status, missing).toBe(503);
      expect(await res.text()).toContain(NOT_CONFIGURED);
      expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("when configured: refreshes with getClaims() using the publishable key, passes through, noindex and no-store", async () => {
    setAll();
    const res = await middleware(new NextRequest("http://localhost:3020/admin/sign-in"));
    expect(createServerClient).toHaveBeenCalledTimes(1);
    expect(createServerClient.mock.calls[0][0]).toBe("test-supabase_url");
    expect(createServerClient.mock.calls[0][1]).toBe("test-supabase_publishable_key");
    expect(getClaims).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("never hands the secret key to the Auth client", async () => {
    setAll();
    await middleware(new NextRequest("http://localhost:3020/admin"));
    expect(JSON.stringify(createServerClient.mock.calls[0].slice(0, 2))).not.toContain("secret");
  });
});
