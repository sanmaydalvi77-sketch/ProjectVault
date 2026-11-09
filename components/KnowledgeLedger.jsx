
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function KnowledgeLedger({ projectId }) {
  const [claims, setClaims] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState("");

  const supabase = createClient();

  async function loadClaims() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("knowledge_claims")
      .select(
        "id, claim_text, claim_type, evidence_quote, evidence_locator, support_status, review_status, reviewer_notes, created_at"
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setClaims(data || []);
    }

    setLoading(false);
  }

  async function loadRelationships() {
    const { data, error } = await supabase
      .from("claim_relationships")
      .select(
        "id, source_claim_id, target_claim_id, relationship_type, explanation, review_status, created_at"
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setRelationships(data || []);
    }
  }

  async function refreshLedger() {
    await Promise.all([loadClaims(), loadRelationships()]);
  }

  useEffect(() => {
    refreshLedger();
  }, [projectId]);

  async function analyzeRelationships() {
    if (claims.length < 2) {
      setAnalysisMessage(
        "At least two claims are needed for relationship analysis."
      );
      return;
    }

    setAnalyzing(true);
    setError("");
    setAnalysisMessage("");

    try {
      const response = await fetch("/api/claims/relationships", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ projectId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Relationship analysis failed."
        );
      }

      setAnalysisMessage(
        `${result.relationshipsCreated} new relationships detected from ${result.claimsAnalyzed} claims.`
      );

      await loadRelationships();
    } catch (err) {
      setError(err.message || "Could not analyze relationships.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function updateRelationship(relationshipId, reviewStatus) {
    const action =
      reviewStatus === "confirmed" ? "confirm" : "dismiss";

    const verified = window.confirm(
      `Are you sure you want to ${action} this AI-suggested relationship?`
    );

    if (!verified) return;

    setUpdatingId(relationshipId);
    setError("");

    const { error } = await supabase
      .from("claim_relationships")
      .update({ review_status: reviewStatus })
      .eq("id", relationshipId)
      .eq("project_id", projectId);

    if (error) {
      setError(error.message);
    } else {
      await loadRelationships();
    }

    setUpdatingId(null);
  }

  async function updateReview(claimId, reviewStatus) {
    let supportStatus;

    if (reviewStatus === "approved") {
      const verified = window.confirm(
        "Have you personally checked the supporting evidence and confirmed that it supports this claim?"
      );

      if (!verified) return;

      supportStatus = "supported";
    }

    const notes = window.prompt(
      reviewStatus === "approved"
        ? "Add optional approval notes:"
        : "Why are you rejecting this claim?"
    );

    if (notes === null) return;

    setUpdatingId(claimId);
    setError("");

    const updates = {
      review_status: reviewStatus,
      reviewer_notes: notes,
      updated_at: new Date().toISOString(),
    };

    if (supportStatus) {
      updates.support_status = supportStatus;
    }

    const { error } = await supabase
      .from("knowledge_claims")
      .update(updates)
      .eq("id", claimId)
      .eq("project_id", projectId);

    if (error) {
      setError(error.message);
    } else {
      await loadClaims();
    }

    setUpdatingId(null);
  }

  const supportedCount = claims.filter(
    (claim) => claim.support_status === "supported"
  ).length;

  const unverifiedCount = claims.filter(
    (claim) => claim.support_status === "unverified"
  ).length;

  const conflictingCount = claims.filter(
    (claim) => claim.support_status === "conflicting"
  ).length;

  const pendingCount = claims.filter(
    (claim) => claim.review_status === "pending"
  ).length;

  const approvedCount = claims.filter(
    (claim) => claim.review_status === "approved"
  ).length;

  const rejectedCount = claims.filter(
    (claim) => claim.review_status === "rejected"
  ).length;

  const pendingRelationships = relationships.filter(
    (item) => item.review_status === "pending"
  ).length;

  const filteredClaims = claims.filter((claim) => {
    const matchesFilter =
      activeFilter === "all" ||
      (activeFilter === "pending" && claim.review_status === "pending") ||
      (activeFilter === "approved" && claim.review_status === "approved") ||
      (activeFilter === "rejected" && claim.review_status === "rejected") ||
      (activeFilter === "unverified" &&
        claim.support_status === "unverified") ||
      (activeFilter === "conflicting" &&
        claim.support_status === "conflicting");

    const searchContent = [
      claim.claim_text,
      claim.claim_type,
      claim.evidence_quote,
      claim.reviewer_notes,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      matchesFilter &&
      searchContent.includes(searchTerm.toLowerCase())
    );
  });

  function statusStyle(status) {
    const styles = {
      supported: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
      unverified: "border-amber-500/20 bg-amber-500/10 text-amber-400",
      conflicting: "border-red-500/20 bg-red-500/10 text-red-400",
      pending: "border-amber-500/20 bg-amber-500/10 text-amber-400",
      approved: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
      rejected: "border-red-500/20 bg-red-500/10 text-red-400",
    };

    return styles[status] || "border-slate-700 bg-slate-800 text-slate-300";
  }

  function StatusBadge({ status, label }) {
    return (
      <span
        className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold capitalize ${statusStyle(status)}`}
      >
        {label || status}
      </span>
    );
  }

  const filters = [
    { id: "all", label: "All claims", count: claims.length },
    { id: "pending", label: "Pending review", count: pendingCount },
    { id: "approved", label: "Approved", count: approvedCount },
    { id: "rejected", label: "Rejected", count: rejectedCount },
    { id: "unverified", label: "Unverified", count: unverifiedCount },
    { id: "conflicting", label: "Conflicting", count: conflictingCount },
  ];

  const relationshipLabels = {
    contradicts: "⚠ Contradicts",
    supports: "✓ Supports",
    duplicates: "≡ Duplicate",
    depends_on: "↳ Depends on",
  };

  const claimMap = new Map(
    claims.map((claim) => [claim.id, claim])
  );

  if (loading) {
    return (
      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center text-sm text-slate-400">
        Loading Knowledge Ledger...
      </div>
    );
  }

  return (
    <section className="mt-8 space-y-7">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-400">
            Evidence & Verification
          </p>

          <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">
            Knowledge Confidence Ledger
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Every extracted claim is tracked against its source evidence.
            Review, verify and approve project knowledge before it enters
            the final handover.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
          <p className="text-xs text-slate-500">Total extracted claims</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {claims.length}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Relationship Intelligence */}
      <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.05] p-5 md:p-6">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-400">
              Project Intelligence Engine
            </p>

            <h3 className="mt-2 text-xl font-bold text-white">
              Evidence Relationship Intelligence
            </h3>

            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
              Discover possible contradictions, supporting claims,
              duplicate information and project dependencies.
              Every AI suggestion requires human review.
            </p>

            <p className="mt-3 text-xs text-slate-500">
              {relationships.length} relationships detected ·{" "}
              {pendingRelationships} awaiting review
            </p>
          </div>

          <button
            type="button"
            onClick={analyzeRelationships}
            disabled={analyzing || claims.length < 2}
            className="shrink-0 rounded-xl bg-purple-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {analyzing
              ? "Analyzing claims..."
              : "✦ Analyze Relationships"}
          </button>
        </div>

        {analysisMessage && (
          <p className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-400">
            {analysisMessage}
          </p>
        )}

        {relationships.length > 0 && (
          <div className="mt-6 space-y-3 border-t border-slate-800 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold text-white">
                Detected relationships
              </h4>
              <span className="text-xs text-slate-500">
                AI suggestions · Human review required
              </span>
            </div>

            {relationships.map((relationship) => {
              const source = claimMap.get(
                relationship.source_claim_id
              );
              const target = claimMap.get(
                relationship.target_claim_id
              );

              return (
                <div
                  key={relationship.id}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StatusBadge
                      status={relationship.review_status}
                      label={relationship.review_status}
                    />

                    <span className="text-xs font-semibold text-purple-300">
                      {relationshipLabels[relationship.relationship_type] ||
                        relationship.relationship_type}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg bg-slate-900 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Source claim
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-200">
                        {source?.claim_text || "Claim unavailable"}
                      </p>
                    </div>

                    <div className="rounded-lg bg-slate-900 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Related claim
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-200">
                        {target?.claim_text || "Claim unavailable"}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    <span className="font-semibold text-slate-300">
                      AI explanation:{" "}
                    </span>
                    {relationship.explanation}
                  </p>

                  {relationship.review_status === "pending" && (
                    <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-800 pt-4">
                      <button
                        type="button"
                        disabled={updatingId !== null}
                        onClick={() =>
                          updateRelationship(
                            relationship.id,
                            "confirmed"
                          )
                        }
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-40"
                      >
                        {updatingId === relationship.id
                          ? "Saving..."
                          : "✓ Confirm relationship"}
                      </button>

                      <button
                        type="button"
                        disabled={updatingId !== null}
                        onClick={() =>
                          updateRelationship(
                            relationship.id,
                            "dismissed"
                          )
                        }
                        className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 disabled:opacity-40"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confidence Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-5">
          <p className="text-sm font-medium text-emerald-300">Supported</p>
          <p className="mt-3 text-3xl font-bold text-white">
            {supportedCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Evidence personally verified
          </p>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-5">
          <p className="text-sm font-medium text-amber-300">Unverified</p>
          <p className="mt-3 text-3xl font-bold text-white">
            {unverifiedCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Evidence needs verification
          </p>
        </div>

        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-5">
          <p className="text-sm font-medium text-red-300">Conflicting</p>
          <p className="mt-3 text-3xl font-bold text-white">
            {conflictingCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Conflicting evidence identified
          </p>
        </div>

        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] p-5">
          <p className="text-sm font-medium text-blue-300">
            Pending Review
          </p>
          <p className="mt-3 text-3xl font-bold text-white">
            {pendingCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Awaiting human decision
          </p>
        </div>
      </div>

      {/* Review Policy */}
      <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.05] p-5">
        <div className="flex items-start gap-3">
          <span className="text-xl">🛡️</span>
          <div>
            <h3 className="font-semibold text-white">
              Human-in-the-loop verification
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              AI extracts claims and identifies relationships.
              A human must verify evidence and review relationships
              before they become part of trusted project knowledge.
            </p>
            <p className="mt-3 text-sm font-bold text-purple-300">
              No approval → No final share.
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-bold text-white">Review workspace</h3>
            <p className="mt-1 text-xs text-slate-500">
              Find claims and track their review decisions.
            </p>
          </div>

          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search claims or evidence..."
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-purple-500 md:max-w-sm"
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                activeFilter === filter.id
                  ? "bg-purple-600 text-white"
                  : "border border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-500 hover:text-white"
              }`}
            >
              {filter.label}
              <span className="ml-2 opacity-70">
                {filter.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Claims */}
      {claims.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-12 text-center">
          <div className="text-4xl">🧠</div>
          <h3 className="mt-4 text-lg font-bold text-white">
            Your Knowledge Ledger is waiting
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Upload and analyze a project document to extract claims
            and supporting evidence.
          </p>
        </div>
      ) : filteredClaims.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-10 text-center">
          <p className="font-semibold text-white">
            No matching claims found.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Try another filter or search term.
          </p>
          <button
            type="button"
            onClick={() => {
              setActiveFilter("all");
              setSearchTerm("");
            }}
            className="mt-4 text-sm font-semibold text-purple-400 hover:text-purple-300"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredClaims.map((claim, index) => (
            <article
              key={claim.id}
              className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 transition hover:border-slate-700"
            >
              <div className="p-5 md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Claim #{index + 1}
                    </span>

                    <span className="rounded-md bg-slate-800 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {claim.claim_type || "General"}
                    </span>
                  </div>

                  <span className="text-xs text-slate-600">
                    {new Date(claim.created_at).toLocaleDateString("en-IN")}
                  </span>
                </div>

                <h3 className="mt-5 text-base font-semibold leading-7 text-white">
                  {claim.claim_text}
                </h3>

                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusBadge
                    status={claim.support_status}
                    label={`Evidence: ${claim.support_status}`}
                  />
                  <StatusBadge
                    status={claim.review_status}
                    label={`Review: ${claim.review_status}`}
                  />
                </div>

                <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950 p-4 md:p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">
                    Supporting evidence
                  </p>

                  <blockquote className="mt-3 border-l-2 border-purple-500 pl-4 text-sm leading-7 text-slate-300">
                    {claim.evidence_quote || "No evidence quote available."}
                  </blockquote>

                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-800 pt-3 text-xs text-slate-500">
                    <span>
                      Source:{" "}
                      <span className="text-slate-300">
                        {claim.evidence_locator?.location || "Not available"}
                      </span>
                    </span>

                    {claim.evidence_locator?.chunk_index !== undefined && (
                      <span>
                        Chunk:{" "}
                        <span className="text-slate-300">
                          {claim.evidence_locator.chunk_index}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {claim.reviewer_notes && (
                  <div className="mt-4 rounded-xl border border-blue-500/15 bg-blue-500/[0.04] p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                      Reviewer notes
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {claim.reviewer_notes}
                    </p>
                  </div>
                )}

                {claim.review_status === "pending" ? (
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-5">
                    <p className="text-xs text-slate-500">
                      Verify the evidence before approving this claim.
                    </p>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => updateReview(claim.id, "approved")}
                        disabled={updatingId !== null}
                        className="rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-40"
                      >
                        {updatingId === claim.id ? "Saving..." : "✓ Approve"}
                      </button>

                      <button
                        type="button"
                        onClick={() => updateReview(claim.id, "rejected")}
                        disabled={updatingId !== null}
                        className="rounded-lg border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-xs font-bold text-red-400 hover:bg-red-500/20 disabled:opacity-40"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 border-t border-slate-800 pt-4">
                    <p className="text-xs text-slate-500">
                      {claim.review_status === "approved"
                        ? "This claim has been approved by human review."
                        : "This claim was rejected during human review."}
                    </p>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-5">
        <p className="text-xs text-slate-500">
          Showing {filteredClaims.length} of {claims.length} claims
        </p>

        <button
          type="button"
          onClick={refreshLedger}
          className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
        >
          ↻ Refresh Ledger
        </button>
      </div>
    </section>
  );
}
