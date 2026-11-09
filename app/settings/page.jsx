
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WorkspaceShell from "@/components/WorkspaceShell";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { claims },
    error: authError,
  } = await supabase.auth.getClaims();

  if (authError || !claims) {
    redirect("/login");
  }

  const email = claims.email || "Email unavailable";

  const { count: projectCount } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true });

  return (
    <WorkspaceShell>
      <div className="mb-10">
        <p className="mb-2 text-sm font-medium text-blue-400">
          WORKSPACE / SETTINGS
        </p>

        <h1 className="text-4xl font-bold">Settings</h1>

        <p className="mt-3 text-slate-400">
          Manage your account and view workspace information.
        </p>
      </div>

      <div className="grid max-w-3xl gap-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-7">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/15 text-2xl text-blue-400">
              👤
            </div>

            <div>
              <h2 className="text-xl font-semibold">Account Profile</h2>
              <p className="text-sm text-slate-400">
                Your authenticated account information
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl bg-slate-950 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Email Address
              </p>
              <p className="mt-2 font-medium">{email}</p>
            </div>

            <div className="rounded-xl bg-slate-950 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Authentication
              </p>
              <p className="mt-2 font-medium text-green-400">
                ● Authenticated with Supabase
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-7">
          <h2 className="text-xl font-semibold">Workspace Overview</h2>

          <p className="mt-2 text-sm text-slate-400">
            Your current ProjectVault workspace.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-950 p-5">
              <p className="text-sm text-slate-400">Total Projects</p>
              <p className="mt-2 text-3xl font-bold text-blue-400">
                {projectCount ?? 0}
              </p>
            </div>

            <div className="rounded-xl bg-slate-950 p-5">
              <p className="text-sm text-slate-400">Platform</p>
              <p className="mt-2 text-xl font-bold">ProjectVault</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-7">
          <h2 className="text-xl font-semibold">Quick Navigation</h2>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link
              href="/"
              className="rounded-xl border border-slate-700 p-4 text-sm hover:border-blue-500"
            >
              ← Back to Dashboard
            </Link>

            <Link
              href="/projects"
              className="rounded-xl border border-slate-700 p-4 text-sm hover:border-blue-500"
            >
              View My Projects →
            </Link>
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}
