// pnpm record:admin list | add <email> | remove <email>
//
// The allowlist for the record view (public.app_admins) and the Auth users
// behind it. Changing it is a person's act, the same way committing a real
// import is: `add` and `remove` require standard input to be an interactive
// terminal and the address typed back exactly. Without a terminal they exit 1
// with NEEDS_TERMINAL before any client is constructed or request is made.
// There is no flag or variable around this. Agents never run add or remove.
//
//   list            prints the allowlist
//   add <email>     lowercases the address, inserts the app_admins row, and
//                   creates the Auth user for it, already confirmed, if none
//                   exists (so sign-in with shouldCreateUser: false finds it)
//   remove <email>  deletes the row and the Auth user
// add and remove end by printing the allowlist read back from the database.

import { createInterface } from "node:readline/promises";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { db, describeError } from "./db";

export const NEEDS_TERMINAL = "changing the allowlist needs a person at a terminal";
const USAGE = "usage: pnpm record:admin list | add <email> | remove <email>";

export type AdminArgs = { command: "list" } | { command: "add" | "remove"; email: string } | { error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseAdminArgs(argv: string[]): AdminArgs {
  const [command, email, ...rest] = argv;
  if (command === "list" && email === undefined) return { command };
  if ((command === "add" || command === "remove") && email !== undefined && rest.length === 0) {
    const normalized = email.trim().toLowerCase();
    if (!EMAIL.test(normalized)) return { error: `not an email address: ${JSON.stringify(email)}` };
    return { command, email: normalized };
  }
  return { error: USAGE };
}

async function printAllowlist(client: SupabaseClient): Promise<number> {
  const { data, error } = await client.from("app_admins").select("email, added_at, note").order("email");
  if (error) {
    console.error(`Could not read app_admins: ${describeError(error)}`);
    return 1;
  }
  console.log(`Allowlist (${data.length}):`);
  if (data.length === 0) console.log("  (empty)");
  for (const r of data) console.log(`  ${r.email}  added ${r.added_at}${r.note ? `  ${r.note}` : ""}`);
  return 0;
}

async function authUserByEmail(client: SupabaseClient, email: string): Promise<User | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listing Auth users: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
}

async function confirmAtTerminal(command: "add" | "remove", email: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const what = command === "add" ? "adds an address to" : "removes an address from";
    const answer = await rl.question(
      `This ${what} the Operation Kokua record view's allowlist. Type the address exactly to proceed (${JSON.stringify(email)}), or anything else to stop: `,
    );
    return answer === email;
  } finally {
    rl.close();
  }
}

export async function runAdmin(argv: string[]): Promise<number> {
  const args = parseAdminArgs(argv);
  if ("error" in args) {
    console.error(args.error);
    return 1;
  }
  // A change to the allowlist is made only by a person at a terminal. Checked
  // before any client is constructed or request is made.
  if (args.command !== "list" && process.stdin.isTTY !== true) {
    console.error(NEEDS_TERMINAL);
    return 1;
  }
  if (args.command === "list") return printAllowlist(db());

  if (!(await confirmAtTerminal(args.command, args.email))) {
    console.error("Not confirmed: nothing was changed.");
    return 1;
  }
  const client = db();
  if (args.command === "add") {
    const { error } = await client.from("app_admins").insert({ email: args.email });
    if (error) {
      console.error(`Could not add ${args.email} to app_admins: ${describeError(error)}`);
      return 1;
    }
    console.log(`Added ${args.email} to app_admins.`);
    const existing = await authUserByEmail(client, args.email);
    if (existing) {
      console.log(`Auth user already exists for ${args.email}.`);
    } else {
      const { error: cErr } = await client.auth.admin.createUser({ email: args.email, email_confirm: true });
      if (cErr) {
        console.error(`Could not create the Auth user for ${args.email}: ${cErr.message}`);
        await printAllowlist(client);
        return 1;
      }
      console.log(`Created a confirmed Auth user for ${args.email}.`);
    }
  } else {
    const { error } = await client.from("app_admins").delete().eq("email", args.email);
    if (error) {
      console.error(`Could not remove ${args.email} from app_admins: ${describeError(error)}`);
      return 1;
    }
    console.log(`Removed ${args.email} from app_admins (if it was there).`);
    const existing = await authUserByEmail(client, args.email);
    if (existing) {
      const { error: dErr } = await client.auth.admin.deleteUser(existing.id);
      if (dErr) {
        console.error(`Could not delete the Auth user for ${args.email}: ${dErr.message}`);
        await printAllowlist(client);
        return 1;
      }
      console.log(`Deleted the Auth user for ${args.email}.`);
    } else {
      console.log(`No Auth user for ${args.email}.`);
    }
  }
  return printAllowlist(client);
}

if (require.main === module) {
  runAdmin(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      console.error(`record:admin failed: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    },
  );
}
