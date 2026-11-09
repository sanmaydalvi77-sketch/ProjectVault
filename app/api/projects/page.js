import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WorkspaceShell from "@/components/WorkspaceShell";

export default async function ProjectsPage() {
  const supabase = await createClient();

  const {
    data: { claims },
    error: authError,
  } = await supabase.auth.getClaims();

  if (authError || !claims) {
    redirect("/login");
  }

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, description, created_at")
    .order("created_at", { ascending: false });

  return (
    <WorkspaceShell>
      <div className="mb-10">
        <p className="mb-2 text-sm font-medium text-blue-400">
          WORKSPACE / PROJECTS
        </p>

        <h1 className="text-4xl font-bold tracking-tight">
          My Projects
        </h1>

        <p className="mt-3 text-slate-400">
          Manage your projects, documents, and verified knowledge.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
          Unable to load projects. Please refresh the page.
        </div>
      ) : projects?.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
          <h2 className="text-xl font-semibold">
            Your workspace is empty
          </h2>

          <p className="mt-3 text-slate-400">
            Create your first project from the dashboard to get started.
          </p>

          <Link
            href="/"
            className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 font-medium hover:bg-blue-500"
          >
            Go to Dashboard
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {projects?.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:-translate-y-1 hover:border-blue-500/50 hover:bg-slate-900/80"
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="rounded-xl bg-blue-500/10 p-3 text-xl text-blue-400">
                  ◈
                </div>

                <span className="text-xs text-slate-500">
                  OPEN PROJECT →
                </span>
              </div>

              <h2 className="text-xl font-semibold group-hover:text-blue-400">
                {project.name}
              </h2>

              <p className="mt-2 min-h-12 text-sm leading-6 text-slate-400">
                {project.description || "No description provided."}
              </p>

              <p className="mt-6 border-t border-slate-800 pt-4 text-xs text-slate-500">
                Created{" "}
                {new Date(project.created_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </WorkspaceShell>
  );
}