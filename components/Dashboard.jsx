
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import FeatureCard from "@/components/FeatureCard";
import Sidebar from "@/components/Sidebar";

export default function Home() {
  const router = useRouter();

  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectError, setProjectError] = useState("");
  const [savingProject, setSavingProject] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");

  async function handleLogout() {
    const supabase = createClient();

    const { error } = await supabase.auth.signOut({
      scope: "local",
    });

    if (error) {
      alert(error.message);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  useEffect(() => {
    async function fetchProjects() {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setProjectError(
          "Unable to verify your login. Please log in again."
        );
        setLoadingProjects(false);
        return;
      }

      const { data, error } = await supabase
        .from("projects")
        .select("id, name, description, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        setProjectError(error.message);
      } else {
        setProjects(data || []);
      }

      setLoadingProjects(false);
    }

    fetchProjects();
  }, []);

  async function handleCreateProject(event) {
    event.preventDefault();

    if (!projectName.trim()) {
      setProjectError("Please enter a project name.");
      return;
    }

    setSavingProject(true);
    setProjectError("");

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: projectName.trim(),
          description: projectDescription.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to create project."
        );
      }

      setProjects((currentProjects) => [
        result.project,
        ...currentProjects,
      ]);

      setProjectName("");
      setProjectDescription("");
      setShowForm(false);
    } catch (error) {
      setProjectError(
        error.message || "Unable to create project."
      );
    } finally {
      setSavingProject(false);
    }
  }

  const features = [
    {
      title: "Smart Extraction",
      description:
        "Extract decisions, tasks, risks and dependencies from project documents.",
      icon: "🧠",
    },
    {
      title: "Knowledge Confidence Ledger",
      description:
        "Track supported, unverified and conflicting information with evidence.",
      icon: "📊",
    },
    {
      title: "Evidence Tracking",
      description:
        "Trace important claims back to their original source documents.",
      icon: "🔍",
    },
    {
      title: "Seamless Handover",
      description:
        "Transform reviewed project knowledge into actionable handover reports.",
      icon: "🚀",
    },
    {
      title: "AI Project Analysis",
      description:
        "Understand project context through AI-powered document analysis.",
      icon: "🤖",
    },
  ];

  return (
    <main className="min-h-screen bg-[#080d19] text-white">
      <Sidebar onLogout={handleLogout} />

      <section className="px-5 pb-12 pt-24 md:ml-72 md:px-10 md:py-10">
        {/* Header */}
        <header className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-medium text-blue-400">
              PROJECTVAULT / WORKSPACE
            </p>

            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Your command center.
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400 md:text-base">
              Keep project knowledge organized, evidence-backed and ready
              for the next handover.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setProjectError("");
              setShowForm(!showForm);
            }}
            className="w-full rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold shadow-lg shadow-blue-950/40 transition hover:-translate-y-0.5 hover:bg-blue-500 sm:w-auto"
          >
            + Create New Project
          </button>
        </header>

        {/* Welcome Banner */}
        <div className="relative mb-9 overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-950/80 via-slate-900 to-slate-900 p-6 md:p-8">
          <div className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative max-w-2xl">
            <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-medium text-blue-300">
              AI-POWERED KNOWLEDGE WORKSPACE
            </span>

            <h2 className="mt-5 text-2xl font-bold md:text-3xl">
              Projects should never lose their knowledge.
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              Upload documents, extract project insights, review evidence
              and create reliable handover reports — all in one place.
            </p>

            <Link
              href="/projects"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-400 transition hover:text-blue-300"
            >
              Explore your projects <span>→</span>
            </Link>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="mb-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 transition hover:border-blue-500/40">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">Your Projects</p>
              <span className="text-xl">📁</span>
            </div>
            <p className="mt-4 text-3xl font-bold tabular-nums">
              {loadingProjects ? "—" : projects.length}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Projects in your workspace
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 transition hover:border-purple-500/40">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">Knowledge Workflows</p>
              <span className="text-xl">⚡</span>
            </div>
            <p className="mt-4 text-3xl font-bold">03</p>
            <p className="mt-2 text-xs text-slate-500">
              Documents, analysis and review
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 transition hover:border-emerald-500/40">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">Review Policy</p>
              <span className="text-xl">🛡️</span>
            </div>
            <p className="mt-4 text-2xl font-bold text-emerald-400">
              Human-led
            </p>
            <p className="mt-2 text-xs text-slate-500">
              No approval, no final share
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <section className="mb-10">
          <div className="mb-5">
            <h2 className="text-xl font-bold">Quick access</h2>
            <p className="mt-1 text-sm text-slate-500">
              Jump directly into your workspace tools.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Link
              href="/projects"
              className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition hover:-translate-y-1 hover:border-blue-500/50 hover:bg-slate-900"
            >
              <span className="text-2xl">📂</span>
              <h3 className="mt-4 font-semibold">My Projects</h3>
              <p className="mt-2 text-sm text-slate-500">
                View and manage your projects.
              </p>
              <p className="mt-4 text-sm font-medium text-blue-400 group-hover:text-blue-300">
                Open projects →
              </p>
            </Link>

            <Link
              href="/documents"
              className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition hover:-translate-y-1 hover:border-purple-500/50 hover:bg-slate-900"
            >
              <span className="text-2xl">📄</span>
              <h3 className="mt-4 font-semibold">Documents</h3>
              <p className="mt-2 text-sm text-slate-500">
                Access project documents and extraction.
              </p>
              <p className="mt-4 text-sm font-medium text-purple-400 group-hover:text-purple-300">
                Open documents →
              </p>
            </Link>

            <Link
              href="/knowledge"
              className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition hover:-translate-y-1 hover:border-emerald-500/50 hover:bg-slate-900"
            >
              <span className="text-2xl">◈</span>
              <h3 className="mt-4 font-semibold">Knowledge Ledger</h3>
              <p className="mt-2 text-sm text-slate-500">
                Review claims and their supporting evidence.
              </p>
              <p className="mt-4 text-sm font-medium text-emerald-400 group-hover:text-emerald-300">
                Open ledger →
              </p>
            </Link>
          </div>
        </section>

        {/* Create Project Form */}
        {showForm && (
          <form
            onSubmit={handleCreateProject}
            className="mb-10 max-w-2xl rounded-2xl border border-blue-500/30 bg-slate-900 p-6 shadow-xl shadow-blue-950/10"
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Create a project</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Start a new knowledge workspace.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label="Close form"
              >
                ✕
              </button>
            </div>

            <label className="mb-2 block text-sm font-medium text-slate-300">
              Project Name
            </label>

            <input
              type="text"
              required
              maxLength={100}
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="e.g. ProjectVault"
              className="mb-5 w-full rounded-xl border border-slate-700 bg-slate-950 p-3.5 text-white outline-none transition focus:border-blue-500"
            />

            <label className="mb-2 block text-sm font-medium text-slate-300">
              Project Description
            </label>

            <textarea
              value={projectDescription}
              maxLength={1000}
              onChange={(event) => setProjectDescription(event.target.value)}
              placeholder="Describe the purpose of this project..."
              rows="3"
              className="mb-6 w-full rounded-xl border border-slate-700 bg-slate-950 p-3.5 text-white outline-none transition focus:border-blue-500"
            />

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={savingProject}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingProject ? "Creating..." : "Create Project"}
              </button>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-slate-700 px-5 py-3 text-sm text-slate-300 transition hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Projects */}
        <section className="mb-12">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Your Projects</h2>
              <p className="mt-1 text-sm text-slate-500">
                Continue where your work left off.
              </p>
            </div>

            <Link
              href="/projects"
              className="text-sm font-medium text-blue-400 hover:text-blue-300"
            >
              View all →
            </Link>
          </div>

          {projectError && (
            <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
              {projectError}
            </div>
          )}

          {loadingProjects ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-10 text-center text-slate-400">
              Loading your projects...
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center">
              <div className="text-4xl">📂</div>
              <h3 className="mt-4 text-lg font-semibold">
                Your workspace starts here.
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Create your first project and start collecting documents,
                decisions and evidence in one organized place.
              </p>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold transition hover:bg-blue-500"
              >
                + Create your first project
              </button>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {projects.map((project) => (
                <Link
                  href={`/projects/${project.id}`}
                  key={project.id}
                  className="group rounded-2xl border border-slate-800 bg-slate-900/70 p-6 transition duration-200 hover:-translate-y-1 hover:border-blue-500/50 hover:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-xl">
                      📁
                    </div>
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                      Workspace
                    </span>
                  </div>

                  <h3 className="mt-5 text-lg font-bold transition group-hover:text-blue-400">
                    {project.name}
                  </h3>

                  <p className="mt-2 min-h-10 text-sm leading-6 text-slate-500">
                    {project.description || "No description provided."}
                  </p>

                  <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-4">
                    <span className="text-xs text-slate-500">
                      {project.created_at
                        ? new Date(project.created_at).toLocaleDateString()
                        : "Recently created"}
                    </span>
                    <span className="text-sm font-medium text-blue-400 group-hover:translate-x-1">
                      Open project →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Features */}
        <section>
          <div className="mb-6">
            <h2 className="text-xl font-bold">Built for project continuity</h2>
            <p className="mt-1 text-sm text-slate-500">
              The tools that help preserve and transfer project knowledge.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => (
              <FeatureCard
                key={feature.title}
                title={feature.title}
                description={feature.description}
                icon={feature.icon}
              />
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-14 border-t border-slate-800 pt-6 text-center text-xs text-slate-600">
          ProjectVault — Preserve knowledge. Enable continuity.
        </footer>
      </section>
    </main>
  );
}
