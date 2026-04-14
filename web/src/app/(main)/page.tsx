import { redirect } from "next/navigation";

/**
 * Root page — redirects to the JTG homepage with default locale.
 * The actual homepage lives at /[locale] under the (jtg) route group.
 */
export default function RootPage() {
  redirect("/zh-Hans");
}
