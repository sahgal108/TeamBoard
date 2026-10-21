import { redirect } from "next/navigation";

// proxy.ts already routes "/" by cookie presence; this covers any path that bypasses it.
export default function Home() {
  redirect("/dashboard");
}
