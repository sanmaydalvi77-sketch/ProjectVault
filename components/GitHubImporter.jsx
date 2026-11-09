
"use client";

import { useState } from "react";

export default function GitHubImporter({ projectId }) {
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  async function handleImport(event) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setSuccess(null);

    try {
      const response = await fetch("/api/github/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          repoUrl: repoUrl.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "GitHub import failed."
        );
      }

      setSuccess(result);
      setRepoUrl("");
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-widest text-purple-400">
          GitHub Integration
        </p>

        <h2 className="mt-2 text-xl font-bold text-white">
          Import Repository
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          Connect a public GitHub repository to bring its README
          and recent commit history into your project knowledge.
        </p>
      </div>

      <form onSubmit={handleImport}>
        <label
          htmlFor="github-repo-url"
          className="mb-2 block text-sm font-medium text-slate-300"
        >
          GitHub Repository URL
        </label>

        <input
          id="github-repo-url"
          type="url"
          value={repoUrl}
          onChange={(event) => setRepoUrl(event.target.value)}
          placeholder="https://github.com/owner/repository"
          required
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-purple-500"
        />

        <button
          type="submit"
          disabled={loading || !repoUrl.trim()}
          className="mt-4 w-full rounded-xl bg-purple-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Importing Repository..." : "Import from GitHub"}
        </button>
      </form>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <p className="font-semibold text-emerald-400">
            Repository imported successfully!
          </p>

          <p className="mt-2 text-sm text-slate-300">
            {success.repository}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-400">
            <div>
              <p className="text-lg font-bold text-white">
                {success.commitCount}
              </p>
              Recent commits
            </div>

            <div>
              <p className="text-lg font-bold text-white">
                {success.characterCount?.toLocaleString("en-IN")}
              </p>
              Imported characters
            </div>
          </div>

          <p className="mt-3 text-xs leading-5 text-slate-400">
            Repository content is saved in your project documents.
            You can now use the existing document analysis workflow.
          </p>
        </div>
      )}
    </div>
  );
}
