import { redirect } from "next/navigation";
import { homePathFor } from "@/lib/roles";
import { getSessionUser } from "@/lib/session";

export default async function Home() {
  const user = await getSessionUser();
  redirect(user ? homePathFor(user) : "/login");
}
