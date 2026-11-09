
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WorkspaceShell from "@/components/WorkspaceShell";

export default async function DocumentsPage() {
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
    .select("id, name, description")
    .order("created_at", { ascending: false });

  return (
    <WorkspaceShell>
      <div className="mb-10">
        <p className="mb-2 text-sm font-medium text-blue-400">
          WORKSPACE / DOCUMENTS
        </p>

        <h1 className="text-4xl font-bold">Documents</h1>

        <p className="mt-3 text-slate-400">
          Select a project to upload, extract and analyze its documents.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-500/10 p-5 text-red-300">
          Unable to load projects.
        </p>
      ) : projects?.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
          <h2 className="text-xl font-semibold">No projects found</h2>
          <p className="mt-3 text-slate-400">
            Create a project before uploading documents.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 font-medium"
          >
            Go to Dashboard
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {projects?.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}/documents`}
              className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:-translate-y-1 hover:border-blue-500/50"
            >
              <div className="mb-5 text-3xl text-blue-400">▤</div>

              <h2 className="text-xl font-semibold group-hover:text-blue-400">
                {project.name}
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                {project.description || "No description provided."}
              </p>

              <p className="mt-6 text-sm font-medium text-blue-400">
                Manage Documents →
              </p>
            </Link>
          ))}
        </div>
      )}
    </WorkspaceShell>
  );
}
