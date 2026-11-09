
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WorkspaceShell from "@/components/WorkspaceShell";
import TaskManager from "@/components/TaskManager";
import ProjectMembers from "@/components/ProjectMembers";

export default async function ProjectDetailsPage({ params }) {
  const { id } = await params;

  const supabase = await createClient();

  // Verify authentication
  const {
    data: { claims },
    error: authError,
  } = await supabase.auth.getClaims();

  if (authError || !claims) {
    redirect("/login");
  }

  // Fetch the selected project
  const { data: project, error } = await supabase
    .from("projects")
    .select("id, name, description, created_at")
    .eq("id", id)
    .single();

  if (error || !project) {
    notFound();
  }

  const createdDate = project.created_at
    ? new Date(project.created_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Not available";

  const workflows = [
    {
      number: "01",
      title: "Upload Documents",
      description:
        "Add PDF, Markdown or text files to your project workspace.",
      detail: "SOURCE MATERIAL",
      icon: "📄",
      href: `/projects/${id}/documents`,
      color: "purple",
    },
    {
      number: "02",
      title: "Extract Knowledge",
      description:
        "Use AI to identify decisions, tasks, risks and important claims.",
      detail: "AI ANALYSIS",
      icon: "🧠",
      href: `/projects/${id}/documents`,
      color: "blue",
    },
    {
      number: "03",
      title: "Verify Evidence",
      description:
        "Review extracted claims and check their supporting evidence.",
      detail: "HUMAN REVIEW",
      icon: "◈",
      href: `/projects/${id}/knowledge`,
      color: "emerald",
    },
    {
      number: "04",
      title: "Generate Handover",
      description:
        "Create a structured report from approved project knowledge.",
      detail: "KNOWLEDGE TRANSFER",
      icon: "🚀",
      href: `/projects/${id}/reports`,
      color: "orange",
    },
  ];

  const tools = [
    {
      title: "Documents",
      description: "Upload files, extract text and run AI analysis.",
      icon: "📁",
      href: `/projects/${id}/documents`,
      color: "purple",
      action: "Manage documents",
    },
    {
      title: "Knowledge Confidence Ledger",
      description:
        "Inspect supported, unverified and conflicting claims.",
      icon: "◈",
      href: `/projects/${id}/knowledge`,
      color: "emerald",
      action: "Open knowledge ledger",
    },
    {
      title: "Handover Reports",
      description:
        "Generate reports from human-reviewed project knowledge.",
      icon: "📑",
      href: `/projects/${id}/reports`,
      color: "blue",
      action: "View handover reports",
    },
  ];

  return (
    <WorkspaceShell>
      <div className="mx-auto max-w-7xl">

        {/* Breadcrumb */}
        <div className="mb-7 flex flex-wrap items-center gap-2 text-sm">
          <Link
            href="/"
            className="text-slate-500 transition hover:text-white"
          >
            Dashboard
          </Link>
          <span className="text-slate-700">/</span>
          <Link
            href="/projects"
            className="text-slate-500 transition hover:text-white"
          >
            Projects
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-blue-400">{project.name}</span>
        </div>

        {/* Project Header */}
        <section className="relative mb-9 overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-950/80 via-slate-900 to-slate-950 p-7 md:p-10">
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold tracking-wide text-blue-300">
                PROJECT WORKSPACE
              </span>
              <span className="text-xs text-slate-500">
                Created {createdDate}
              </span>
            </div>

            <h1 className="mt-6 break-words text-3xl font-bold tracking-tight md:text-4xl">
              {project.name}
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 md:text-base">
              {project.description ||
                "Your dedicated space to preserve project knowledge, verify evidence and create reliable handovers."}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={`/projects/${id}/documents`}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold transition hover:bg-blue-500"
              >
                + Upload Documents
              </Link>

              <Link
                href={`/projects/${id}/knowledge`}
                className="rounded-xl border border-slate-700 bg-slate-900/70 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
              >
                Open Knowledge Ledger →
              </Link>
            </div>
          </div>
        </section>

        {/* Workflow */}
        <section className="mb-11">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
              How it works
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              From documents to knowledge.
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Follow the workflow to build an evidence-backed project handover.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {workflows.map((step) => (
              <Link
                key={step.number}
                href={step.href}
                className="group rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition duration-200 hover:-translate-y-1 hover:border-blue-500/40 hover:bg-slate-900"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold tracking-widest text-slate-600">
                    STEP {step.number}
                  </span>
                  <span className="text-2xl">{step.icon}</span>
                </div>

                <p className="mt-6 text-[10px] font-bold tracking-[0.16em] text-blue-400">
                  {step.detail}
                </p>

                <h3 className="mt-2 text-lg font-bold">
                  {step.title}
                </h3>

                <p className="mt-3 min-h-16 text-sm leading-6 text-slate-500">
                  {step.description}
                </p>

                <p className="mt-5 text-sm font-semibold text-blue-400 transition group-hover:translate-x-1">
                  Open step →
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* Project Task Management */}
        <section className="mb-11 rounded-2xl border border-slate-800 bg-slate-950/40 p-5 md:p-7">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-400">
              Work continuity
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              Project execution center
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Assign responsibilities, track progress, identify blockers
              and keep every contributor aligned.
            </p>
          </div>

          <TaskManager projectId={id} />
        </section>

            {/* Project Member Management */}
<section className="mt-8">
  <ProjectMembers projectId={project.id} />
</section>

        {/* Workspace Tools */}
        <section className="mb-11">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">Workspace tools</h2>
            <p className="mt-2 text-sm text-slate-500">
              Access each part of your project knowledge system.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {tools.map((tool) => (
              <Link
                key={tool.title}
                href={tool.href}
                className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition hover:-translate-y-1 hover:border-blue-500/40 hover:bg-slate-900"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-2xl">
                  {tool.icon}
                </div>

                <h3 className="mt-5 text-lg font-bold">
                  {tool.title}
                </h3>

                <p className="mt-3 min-h-12 text-sm leading-6 text-slate-500">
                  {tool.description}
                </p>

                <p className="mt-5 text-sm font-semibold text-blue-400 group-hover:text-blue-300">
                  {tool.action} →
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* Trust and Review Policy */}
        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6 md:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-2xl">
              🛡️
            </div>

            <div>
              <h2 className="text-lg font-bold text-emerald-300">
                Human-reviewed knowledge. Reliable handovers.
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
                AI helps extract and organize information, but it does not
                approve its own claims. Evidence must be reviewed by a human
                before it becomes part of the confirmed knowledge shared in
                a final handover.
              </p>

              <p className="mt-4 text-xs font-bold uppercase tracking-widest text-emerald-400">
                No approval → No final share
              </p>
            </div>
          </div>
        </section>

        <footer className="mt-12 border-t border-slate-800 pt-6 text-center text-xs text-slate-600">
          ProjectVault — Preserve knowledge. Enable continuity.
        </footer>
      </div>
    </WorkspaceShell>
  );
}
