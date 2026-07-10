import { LogoutButton } from "@/components/auth/LogoutButton";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-brand">Rhodes</span>
        <div className="app-header-actions">
          <span className="app-user">{user?.email}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
