import type { Metadata } from "next";
import { site } from "../content/site";
import { isIndexable } from "./indexing";
import { pageTitle } from "./routes";

/** The root layout's metadata: home's title, the mission as description, robots from the one switch. */
export function rootMetadata(env: Record<string, string | undefined> = process.env): Metadata {
  const indexable = isIndexable(env);
  return {
    title: pageTitle("/"),
    description: site.mission.text,
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
  };
}
