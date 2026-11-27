import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The two clients, mocked: the Auth client (visitor's cookies) and the
// secret-key allowlist lookup. redirect() throws, as it does in Next.js.
const { getUser, signOut, isListedAdmin } = vi.hoisted(() => ({ getUser: vi.fn(), signOut: vi.fn(), isListedAdmin: vi.fn() }));
vi.mock("./auth", () => ({ createAuthClient: async () => ({ auth: { getUser, signOut } }) }));
vi.mock("./record", () => ({ isListedAdmin }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

import { requireAdmin } from "./guard";
import { NOT_CONFIGURED } from "./env";
import { SIGN_IN_PATH } from "./paths";

const VARS = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const v of VARS) {
    saved[v] = process.env[v];
    process.env[v] = `test-${v.toLowerCase()}`;
  }
  getUser.mockReset();
  signOut.mockReset().mockResolvedValue({ error: null });
  isListedAdmin.mockReset();
});
afterEach(() => {
  for (const v of VARS) {
    if (saved[v] === undefined) delete process.env[v];
    else process.env[v] = saved[v];
  }
});

const user = (email: string) => ({ data: { user: { id: "u1", email } }, error: null });

describe("requireAdmin()", () => {
  it("no user: redirects to sign-in without a lookup", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireAdmin()).rejects.toThrow(`REDIRECT ${SIGN_IN_PATH}`);
    expect(isListedAdmin).not.toHaveBeenCalled();
  });

  it("an Auth error (expired, revoked or forged session): redirects to sign-in", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "invalid JWT" } });
    await expect(requireAdmin()).rejects.toThrow(`REDIRECT ${SIGN_IN_PATH}`);
    getUser.mockRejectedValue(new Error("network"));
    await expect(requireAdmin()).rejects.toThrow(`REDIRECT ${SIGN_IN_PATH}`);
    expect(isListedAdmin).not.toHaveBeenCalled();
  });

  it("a user off the list: signed out, then redirected", async () => {
    getUser.mockResolvedValue(user("someone@example.com"));
    isListedAdmin.mockResolvedValue(false);
    await expect(requireAdmin()).rejects.toThrow(`REDIRECT ${SIGN_IN_PATH}`);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("a user on the list: passes, returning the email", async () => {
    getUser.mockResolvedValue(user("admin@example.com"));
    isListedAdmin.mockResolvedValue(true);
    await expect(requireAdmin()).resolves.toBe("admin@example.com");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("email case does not matter: the lookup is lowercased", async () => {
    getUser.mockResolvedValue(user("Admin@Example.COM"));
    isListedAdmin.mockImplementation(async (e: string) => e === "admin@example.com");
    await expect(requireAdmin()).resolves.toBe("admin@example.com");
    expect(isListedAdmin).toHaveBeenCalledWith("admin@example.com");
  });

  it("a lookup error closes the door: signed out, then redirected", async () => {
    getUser.mockResolvedValue(user("admin@example.com"));
    isListedAdmin.mockRejectedValue(new Error("reading app_admins: timeout"));
    await expect(requireAdmin()).rejects.toThrow(`REDIRECT ${SIGN_IN_PATH}`);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("a failing sign-out still redirects", async () => {
    getUser.mockResolvedValue(user("someone@example.com"));
    isListedAdmin.mockResolvedValue(false);
    signOut.mockRejectedValue(new Error("network"));
    await expect(requireAdmin()).rejects.toThrow(`REDIRECT ${SIGN_IN_PATH}`);
  });

  it("a user with no email: redirected without a lookup", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    await expect(requireAdmin()).rejects.toThrow(`REDIRECT ${SIGN_IN_PATH}`);
    expect(isListedAdmin).not.toHaveBeenCalled();
  });

  it("missing configuration: throws before any client is used", async () => {
    delete process.env.SUPABASE_SECRET_KEY;
    await expect(requireAdmin()).rejects.toThrow(NOT_CONFIGURED);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("asks the Auth server (getUser), never only the cookie (getSession) or a local decode (getClaims)", async () => {
    const { readFileSync } = await import("node:fs");
    const text = readFileSync(new URL("./guard.ts", import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
    expect(text).toMatch(/auth\.getUser\(\)/);
    expect(text).not.toMatch(/getSession|getClaims/);
  });
});
