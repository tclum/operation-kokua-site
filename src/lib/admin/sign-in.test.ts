import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { signInWithOtp } = vi.hoisted(() => ({ signInWithOtp: vi.fn() }));
vi.mock("./auth", () => ({ createAuthClient: async () => ({ auth: { signInWithOtp } }) }));

import { SignInView } from "@/components/admin/SignInView";
import { LINK_FAILED, SIGN_IN_PATH, SIGN_IN_SENT } from "./paths";
import { originFrom, requestSignIn, SIGN_IN_DONE, SIGN_IN_MIN_MS } from "./sign-in";

const headers = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null });
const LOCAL = headers({ host: "localhost:3020" });

// Block body: a function returned from beforeEach is run as a cleanup hook.
beforeEach(() => {
  signInWithOtp.mockReset();
});

describe("the sign-in action's visible result is the same for any address", () => {
  const outcomes: [string, () => void][] = [
    ["on the list (link sent)", () => signInWithOtp.mockResolvedValue({ data: {}, error: null })],
    ["not on the list", () => signInWithOtp.mockResolvedValue({ data: {}, error: { message: "Signups not allowed for otp", status: 422 } })],
    ["rate limited", () => signInWithOtp.mockResolvedValue({ data: {}, error: { message: "For security purposes...", status: 429 } })],
    ["Auth unreachable", () => signInWithOtp.mockImplementation(() => {
      throw new TypeError("fetch failed");
    })],
  ];

  it("redirects to the same place, after the same minimum time, whatever Auth answers", async () => {
    const results: string[] = [];
    for (const [, arrange] of outcomes) {
      arrange();
      const t0 = Date.now();
      results.push(await requestSignIn("Person@Example.com", LOCAL, 60));
      expect(Date.now() - t0).toBeGreaterThanOrEqual(55);
    }
    expect(new Set(results)).toEqual(new Set([SIGN_IN_DONE]));
    expect(SIGN_IN_DONE).toBe(`${SIGN_IN_PATH}?sent=1`);
    expect(SIGN_IN_MIN_MS).toBeGreaterThanOrEqual(1000);
  });

  it("a blank, missing or absurd address gets the same result without calling Auth", async () => {
    for (const bad of ["", "   ", undefined, null, 42, "x".repeat(400)]) {
      expect(await requestSignIn(bad, LOCAL, 0)).toBe(SIGN_IN_DONE);
    }
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("asks Auth never to create a user, with a redirect to this site's confirm route, lowercased", async () => {
    signInWithOtp.mockResolvedValue({ data: {}, error: null });
    await requestSignIn("  Person@Example.com ", headers({ host: "kokua.forpono.com", "x-forwarded-proto": "https" }), 0);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "person@example.com",
      options: { shouldCreateUser: false, emailRedirectTo: "https://kokua.forpono.com/admin/confirm" },
    });
  });

  it("builds the origin from the request's own headers", () => {
    expect(originFrom(LOCAL)).toBe("http://localhost:3020");
    expect(originFrom(headers({ host: "kokua.forpono.com" }))).toBe("https://kokua.forpono.com");
    expect(originFrom(headers({ host: "internal:3000", "x-forwarded-host": "kokua.forpono.com", "x-forwarded-proto": "https" }))).toBe("https://kokua.forpono.com");
  });

  it("the page after any request shows exactly the one sentence, and no form", () => {
    const html = renderToStaticMarkup(createElement(SignInView, { state: "sent", action: async () => {} }));
    expect(html).toContain(SIGN_IN_SENT);
    expect(html).not.toContain("<form");
    expect(SIGN_IN_SENT).toBe("If that address is on the list, a sign-in link is on its way.");
  });

  it("a bad link shows the link message and the form", () => {
    const html = renderToStaticMarkup(createElement(SignInView, { state: "link-failed", action: async () => {} }));
    expect(html).toContain(LINK_FAILED);
    expect(html).toContain("<form");
    expect(LINK_FAILED).toBe("That link did not work. Request a new one.");
  });
});
