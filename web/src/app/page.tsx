import { redirect } from "next/navigation";

/** The v1 Explorer home retired 2026-08-27 — Build is the front door now. */
export default function Home() {
  redirect("/build");
}
