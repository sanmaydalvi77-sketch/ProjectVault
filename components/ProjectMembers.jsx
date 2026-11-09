
"use client";

import { useEffect, useState } from "react";

export default function ProjectMembers({ projectId }) {
  const [members, setMembers] = useState([]);
  const [currentRole, setCurrentRole] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("contributor");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canInvite = ["owner", "admin"].includes(currentRole);

  async function loadMembers() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/projects/${projectId}/members`,
        { cache: "no-store" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load members.");
      }

      setMembers(result.members || []);
      setCurrentRole(result.currentRole || "");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMembers();
  }, [projectId]);

  async function handleInvite(event) {
    event.preventDefault();

    setSending(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `/api/projects/${projectId}/members`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, role }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Invitation failed.");
      }

      setMessage(result.message);
      setEmail("");
      setRole("contributor");

      await loadMembers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-white">
            Project Members
          </h2>

          {currentRole && (
            <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium capitalize text-blue-400">
              Your role: {currentRole}
            </span>
          )}
        </div>

        <p className="mt-1 text-sm text-gray-400">
          Collaborate with your team using controlled project access.
        </p>
      </div>

      {canInvite && (
        <form onSubmit={handleInvite} className="space-y-4">
          <h3 className="font-medium text-white">
            Invite a team member
          </h3>

          <div>
            <label className="mb-2 block text-sm text-gray-300">
              Member email
            </label>

            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@example.com"
              className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-gray-300">
              Assign role
            </label>

            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#171717] px-4 py-3 text-white outline-none"
            >
              {currentRole === "owner" && (
                <option value="admin">Admin</option>
              )}

              <option value="contributor">Contributor</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={sending}
            className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {sending ? "Sending invitation..." : "Invite Member"}
          </button>
        </form>
      )}

      {currentRole === "contributor" || currentRole === "viewer" ? (
        <p className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-gray-400">
          You have {currentRole} access. Only project owners and admins
          can invite team members.
        </p>
      ) : null}

      {message && (
        <p className="rounded-lg bg-green-500/10 p-3 text-sm text-green-400">
          {message}
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="border-t border-white/10 pt-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-medium text-white">
            Current Members
          </h3>

          <span className="text-xs text-gray-500">
            {members.length} member(s)
          </span>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">
            Loading members...
          </p>
        ) : members.length === 0 ? (
          <p className="text-sm text-gray-400">
            No members found.
          </p>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.user_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/[0.04] p-3"
              >
                <div>
                  <p className="text-sm text-white">
                    User {member.user_id.slice(0, 8)}...
                  </p>

                  <p className="text-xs text-gray-500">
                    Joined{" "}
                    {member.joined_at
                      ? new Date(member.joined_at).toLocaleDateString()
                      : "Recently"}
                  </p>
                </div>

                <span className="rounded-full bg-white/10 px-3 py-1 text-xs capitalize text-gray-300">
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
