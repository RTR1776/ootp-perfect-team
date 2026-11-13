import { redirect } from "next/navigation";

/** The v1 Explorer home retired 2026-08-27 and Build was the front door until 2026-11-12; Today is now. */
export default function Home() {
  redirect("/today");
}
