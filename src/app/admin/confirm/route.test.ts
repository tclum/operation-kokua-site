import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAuthClient, verifyOtp, exchangeCodeForSession } = vi.hoisted(() => {
  const verifyOtp = vi.fn();
  const exchangeCodeForSession = vi.fn();
  return { verifyOtp, exchangeCodeForSession, createAuthClient: vi.fn(async () => ({ auth: { verifyOtp, exchangeCodeForSession } })) };
});
vi.mock("@/lib/admin/auth", () => ({ createAuthClient }));

import { CONFIRM_TITLE } from "@/lib/admin/confirm-page";
import { GET, POST } from "./route";

const BASE = "http://localhost:3020";
const get = (q: string) => GET(new NextRequest(`${BASE}/admin/confirm${q}`));
const post = (fields: Record<string, string>, origin: string | null = BASE) => {
  const body = new URLSearchParams(fields);
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
  if (origin !== null) headers.origin = origin;
  return POST(new NextRequest(`${BASE}/admin/confirm`, { method: "POST", body, headers }));
};
const location = (r: Response) => new URL(r.headers.get("location")!).pathname + new URL(r.headers.get("location")!).search;

// Block body: a function returned from beforeEach is run as a cleanup hook.
beforeEach(() => {
  createAuthClient.mockClear();
  verifyOtp.mockReset().mockResolvedValue({ error: null });
  exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
});

describe("GET /admin/confirm with a token_hash", () => {
  it("makes no Auth call and renders one Continue button posting token_hash and type back", async () => {
    const r = await get("?token_hash=abc123&type=email");
    expect(createAuthClient).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(r.status).toBe(200);
    const html = await r.text();
    expect(html).toContain(`<title>${CONFIRM_TITLE}</title>`);
    expect(CONFIRM_TITLE).toBe("Sign in to the record");
    expect(html.match(/<button\b[^>]*>Continue<\/button>/g)).toHaveLength(1);
    expect(html).toMatch(/<form method="post" action="\/admin\/confirm">/);
    expect(html).toContain('<input type="hidden" name="token_hash" value="abc123">');
    expect(html).toContain('<input type="hidden" name="type" value="email">');
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(r.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("escapes what it echoes", async () => {
    const html = await (await get(`?token_hash=${encodeURIComponent('"><script>x</script>')}&type=magiclink`)).text();
    expect(html).not.toContain("<script>x");
    expect(html).toContain("&quot;&gt;&lt;script&gt;");
  });

  it("a missing, unknown or disallowed type lands on sign-in with the link error and no button", async () => {
    for (const q of ["?token_hash=abc", "?token_hash=abc&type=", "?token_hash=abc&type=recovery", "?token_hash=abc&type=signup", "?token_hash=abc&type=invite", "?token_hash=abc&type=email_change", "?token_hash=abc&type=bogus", ""]) {
      const r = await get(q);
      expect(r.status, q).toBe(303);
      expect(location(r), q).toBe("/admin/sign-in?error=link");
      expect(await r.text(), q).not.toContain("Continue");
    }
    expect(createAuthClient).not.toHaveBeenCalled();
  });
});

describe("POST /admin/confirm", () => {
  it("with a good token: calls verifyOtp once, then /admin", async () => {
    const r = await post({ token_hash: "abc123", type: "email" });
    expect(verifyOtp).toHaveBeenCalledTimes(1);
    expect(verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "abc123" });
    expect(r.status).toBe(303);
    expect(location(r)).toBe("/admin");
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("a bad or expired token lands on sign-in with the link error", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "Token has expired or is invalid" } });
    const r = await post({ token_hash: "old", type: "email" });
    expect(location(r)).toBe("/admin/sign-in?error=link");
    verifyOtp.mockRejectedValue(new Error("network"));
    expect(location(await post({ token_hash: "x", type: "email" }))).toBe("/admin/sign-in?error=link");
  });

  it("a disallowed type or a missing token is refused without calling Auth", async () => {
    for (const f of [{ token_hash: "abc", type: "recovery" }, { token_hash: "abc", type: "signup" }, { token_hash: "abc" }, { type: "email" }, { token_hash: "", type: "email" }]) {
      const r = await post(f as Record<string, string>);
      expect(location(r), JSON.stringify(f)).toBe("/admin/sign-in?error=link");
    }
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("a post from another origin is refused without calling Auth", async () => {
    const r = await post({ token_hash: "abc123", type: "email" }, "https://evil.example");
    expect(location(r)).toBe("/admin/sign-in?error=link");
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});

describe("GET /admin/confirm with a code (unchanged)", () => {
  it("exchanges it, then /admin; a failure lands on sign-in with the link error", async () => {
    const ok = await get("?code=c1");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("c1");
    expect(location(ok)).toBe("/admin");
    exchangeCodeForSession.mockResolvedValue({ error: { message: "invalid" } });
    expect(location(await get("?code=c2"))).toBe("/admin/sign-in?error=link");
  });
});
