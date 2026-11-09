"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";

export default function WorkspaceShell({ children }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();

    await supabase.auth.signOut({ scope: "local" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Sidebar onLogout={handleLogout} />

      <main className="min-h-screen px-5 pb-8 pt-24 md:ml-72 md:px-10 md:py-10">
        {children}
      </main>
    </div>
  );
}