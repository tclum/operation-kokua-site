// The page GET /admin/confirm renders for a token_hash link: one button that
// posts the token back to the route, which then verifies it. Nothing from the
// record. No data access here.

import { CONFIRM_PATH } from "./paths";

export const CONFIRM_TITLE = "Sign in to the record";

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The confirm page: one button that posts the token back. Nothing from the record. */
export function confirmPage(tokenHash: string, type: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${CONFIRM_TITLE}</title>
<style>body{margin:0;background:#F7F4EC;color:#10201F;font:17px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}main{max-width:28rem;margin:0 auto;padding:4rem 1rem}h1{font:600 34px/1.2 Georgia,"Times New Roman",serif;color:#0F5E5A;margin:0 0 .75rem}.rule{height:3px;width:4rem;background:#B03E26;margin-bottom:2rem}button{font:600 17px system-ui,sans-serif;background:#0F5E5A;color:#F7F4EC;border:0;border-radius:4px;padding:.5rem 1.25rem;cursor:pointer}button:focus-visible{outline:3px solid #0F5E5A;outline-offset:3px}</style>
</head><body><main id="main"><h1>${CONFIRM_TITLE}</h1><div class="rule" aria-hidden="true"></div>
<form method="post" action="${CONFIRM_PATH}"><input type="hidden" name="token_hash" value="${escapeHtml(tokenHash)}"><input type="hidden" name="type" value="${escapeHtml(type)}"><button type="submit">Continue</button></form>
</main></body></html>`;
}

