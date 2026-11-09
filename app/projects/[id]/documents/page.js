
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WorkspaceShell from "@/components/WorkspaceShell";
import DocumentUploader from "@/components/DocumentUploader";
import GitHubImporter from "@/components/GitHubImporter";

export default async function ProjectDocumentsPage({ params }) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { claims },
    error: authError,
  } = await supabase.auth.getClaims();

  if (authError || !claims) {
    redirect("/login");
  }

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, name, description")
    .eq("id", id)
    .single();

  if (error || !project) {
    notFound();
  }

  return (
    <WorkspaceShell>
      <div className="mb-8">
        <Link
          href="/documents"
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          ← Back to Documents
        </Link>

        <p className="mt-6 text-sm font-medium text-blue-400">
          PROJECT WORKSPACE / DOCUMENTS
        </p>

        <h1 className="mt-2 text-4xl font-bold">
          {project.name}
        </h1>

        <p className="mt-3 text-slate-400">
          Upload documents or connect your GitHub repository
          to preserve project knowledge.
        </p>
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <DocumentUploader projectId={project.id} />
        </div>

        <GitHubImporter projectId={project.id} />
      </div>
    </WorkspaceShell>
  );
}
