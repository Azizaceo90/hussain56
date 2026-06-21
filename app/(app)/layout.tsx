import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadBootstrap } from "@/lib/bootstrap";
import { DataProvider } from "@/components/DataProvider";
import { Shell } from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getSession();
  if (!ctx) redirect("/login");

  const bootstrap = await loadBootstrap(ctx);

  return (
    <DataProvider initial={bootstrap}>
      <Shell>{children}</Shell>
    </DataProvider>
  );
}
