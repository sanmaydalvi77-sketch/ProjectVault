
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const relationshipLabels = {
  contradicts: "Contradicts",
  supports: "Supports",
  duplicates: "Duplicates",
  depends_on: "Depends on",
};

export default function HandoverReport({
  projectId,
  projectName: initialProjectName,
}) {
  const [projectName, setProjectName] = useState(
    initialProjectName || "ProjectVault Project"
  );
  const [claims, setClaims] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState(null);

  useEffect(() => {
    async function loadReportData() {
      const supabase = createClient();

      const [projectResult, claimsResult, relationshipsResult] =
        await Promise.all([
          supabase
            .from("projects")
            .select("name")
            .eq("id", projectId)
            .single(),

          supabase
            .from("knowledge_claims")
            .select(
              "id, claim_text, claim_type, evidence_quote, evidence_locator, support_status, reviewer_notes, created_at"
            )
            .eq("project_id", projectId)
            .eq("review_status", "approved")
            .order("created_at", { ascending: true }),

          supabase
            .from("claim_relationships")
            .select(
              "id, source_claim_id, target_claim_id, relationship_type, explanation, review_status"
            )
            .eq("project_id", projectId)
            .in("review_status", ["confirmed", "pending"]),
        ]);

      if (projectResult.error) {
        setError(projectResult.error.message);
      } else {
        setProjectName(projectResult.data.name);
      }

      if (claimsResult.error) {
        setError((current) =>
          current
            ? `${current} | ${claimsResult.error.message}`
            : claimsResult.error.message
        );
      } else {
        const approvedClaims = claimsResult.data || [];
        setClaims(approvedClaims);

        if (relationshipsResult.error) {
          setError((current) =>
            current
              ? `${current} | ${relationshipsResult.error.message}`
              : relationshipsResult.error.message
          );
        } else {
          const approvedIds = new Set(
            approvedClaims.map((claim) => claim.id)
          );

          const relevantRelationships = (
            relationshipsResult.data || []
          ).filter(
            (relationship) =>
              approvedIds.has(relationship.source_claim_id) &&
              approvedIds.has(relationship.target_claim_id)
          );

          setRelationships(relevantRelationships);
        }
      }

      setLoading(false);
    }

    loadReportData();
  }, [projectId]);

  const verifiedClaims = claims.filter(
    (claim) => claim.support_status === "supported"
  );

  const unresolvedClaims = claims.filter(
    (claim) => claim.support_status !== "supported"
  );

  const confirmedRelationships = relationships.filter(
    (relationship) => relationship.review_status === "confirmed"
  );

  const pendingRelationships = relationships.filter(
    (relationship) => relationship.review_status === "pending"
  );

  function getClaimText(claimId) {
    return (
      claims.find((claim) => claim.id === claimId)?.claim_text ||
      "Claim unavailable"
    );
  }

  function addClaimToReport(lines, claim, index) {
    lines.push(`${index + 1}. ${claim.claim_text}`);
    lines.push(`Category: ${claim.claim_type || "General"}`);
    lines.push(`Evidence status: ${claim.support_status}`);
    lines.push(
      `Evidence: ${claim.evidence_quote || "No evidence quote available."}`
    );
    lines.push(
      `Source location: ${claim.evidence_locator?.location || "Not available"}`
    );

    if (claim.evidence_locator?.chunk_index !== undefined) {
      lines.push(`Source chunk: ${claim.evidence_locator.chunk_index}`);
    }

    if (claim.reviewer_notes) {
      lines.push(`Reviewer notes: ${claim.reviewer_notes}`);
    }

    lines.push("");
  }

  function addRelationshipsToReport(lines, items, heading) {
    lines.push(heading);
    lines.push("--------------------------------------------------");
    lines.push("");

    if (items.length === 0) {
      lines.push("No relationships in this category.");
      lines.push("");
      return;
    }

    items.forEach((relationship, index) => {
      lines.push(`${index + 1}. ${relationshipLabels[relationship.relationship_type] || relationship.relationship_type}`);
      lines.push(`Source claim: ${getClaimText(relationship.source_claim_id)}`);
      lines.push(`Related claim: ${getClaimText(relationship.target_claim_id)}`);
      lines.push(`Explanation: ${relationship.explanation}`);
      lines.push(`Review status: ${relationship.review_status}`);
      lines.push("");
    });
  }

  function generateReport() {
    const timestamp = new Date().toLocaleString("en-IN");

    const lines = [
      "PROJECTVAULT",
      "PROJECT HANDOVER REPORT",
      "==================================================",
      "",
      `Project: ${projectName}`,
      `Generated: ${timestamp}`,
      "",
      "REPORT SUMMARY",
      "--------------------------------------------------",
      `Total human-approved claims: ${claims.length}`,
      `Evidence-supported claims: ${verifiedClaims.length}`,
      `Unresolved evidence claims: ${unresolvedClaims.length}`,
      `Confirmed knowledge relationships: ${confirmedRelationships.length}`,
      `Pending relationship reviews: ${pendingRelationships.length}`,
      "",
      "1. VERIFIED PROJECT KNOWLEDGE",
      "--------------------------------------------------",
      "",
    ];

    if (verifiedClaims.length === 0) {
      lines.push("No evidence-supported claims are available.");
      lines.push("");
    }

    verifiedClaims.forEach((claim, index) => {
      addClaimToReport(lines, claim, index);
    });

    lines.push("2. UNRESOLVED EVIDENCE");
    lines.push("--------------------------------------------------");
    lines.push("");

    if (unresolvedClaims.length === 0) {
      lines.push("No unresolved approved claims.");
      lines.push("");
    }

    unresolvedClaims.forEach((claim, index) => {
      addClaimToReport(lines, claim, index);
    });

    lines.push("3. CONFIRMED KNOWLEDGE RELATIONSHIPS");
    lines.push("--------------------------------------------------");
    lines.push("");
    lines.push(
      "These relationships have been reviewed and confirmed by a human."
    );
    lines.push("");

    addRelationshipsToReport(
      lines,
      confirmedRelationships,
      "CONFIRMED RELATIONSHIPS"
    );

    lines.push("4. RELATIONSHIPS AWAITING REVIEW");
    lines.push("--------------------------------------------------");
    lines.push("");
    lines.push(
      "These relationships were identified by AI but have not yet been confirmed by a human."
    );
    lines.push("");

    addRelationshipsToReport(
      lines,
      pendingRelationships,
      "PENDING RELATIONSHIPS"
    );

    lines.push("5. REVIEW POLICY");
    lines.push("--------------------------------------------------");
    lines.push(
      "Only human-approved claims are included in this report."
    );
    lines.push(
      "Evidence-supported claims have been marked supported following human verification."
    );
    lines.push(
      "Unverified and conflicting claims are explicitly identified and must not be treated as confirmed facts."
    );
    lines.push(
      "Confirmed relationships have received human review."
    );
    lines.push(
      "Pending relationships are AI-generated suggestions and must not be treated as verified conclusions."
    );
    lines.push("");
    lines.push("Generated by ProjectVault.");
    lines.push("No approval -> No final share.");

    return lines.join("\n");
  }

  function downloadReport() {
    if (claims.length === 0) return;

    const report = generateReport();

    const blob = new Blob([report], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${projectName.replace(
      /[^a-zA-Z0-9_-]/g,
      "_"
    )}-Handover-Report.txt`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
    setGeneratedAt(new Date());
  }

  if (loading) {
    return (
      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center text-sm text-slate-400">
        Preparing your project handover report...
      </div>
    );
  }

  return (
    <section className="mt-8 space-y-7">
      {/* Header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">
          Knowledge Transfer
        </p>

        <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">
          Project Handover Report
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Transform reviewed project knowledge into a structured handover
          that helps the next person understand what is known, what is
          supported and what still needs attention.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Report Cover */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-950 via-slate-900 to-purple-950 p-6 md:p-9">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-blue-300">
              ProjectVault · Official Handover
            </span>

            <span className="text-xs text-slate-500">
              Human-reviewed knowledge
            </span>
          </div>

          <p className="mt-9 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
            Project transition document
          </p>

          <h3 className="mt-3 break-words text-3xl font-bold text-white md:text-4xl">
            {projectName}
          </h3>

          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
            A structured record of approved project knowledge, supporting
            evidence, relationships and unresolved information.
          </p>

          <div className="mt-8 flex flex-wrap gap-8 border-t border-white/10 pt-6">
            <div>
              <p className="text-xs text-slate-500">Approved claims</p>
              <p className="mt-1 text-2xl font-bold text-white">
                {claims.length}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Verified knowledge</p>
              <p className="mt-1 text-2xl font-bold text-emerald-400">
                {verifiedClaims.length}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Confirmed links</p>
              <p className="mt-1 text-2xl font-bold text-blue-300">
                {confirmedRelationships.length}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Pending links</p>
              <p className="mt-1 text-2xl font-bold text-amber-400">
                {pendingRelationships.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Report Readiness */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            Evidence-supported
          </p>

          <p className="mt-3 text-3xl font-bold text-white">
            {verifiedClaims.length}
          </p>

          <p className="mt-2 text-sm text-slate-400">
            Approved claims whose evidence has been personally verified.
          </p>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Requires attention
          </p>

          <p className="mt-3 text-3xl font-bold text-white">
            {unresolvedClaims.length}
          </p>

          <p className="mt-2 text-sm text-slate-400">
            Approved claims with unverified or conflicting evidence.
          </p>
        </div>
      </div>

      {/* Verified Knowledge */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Section 01
            </p>
            <h3 className="mt-2 text-xl font-bold text-white">
              Verified Project Knowledge
            </h3>
          </div>

          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
            {verifiedClaims.length} claims
          </span>
        </div>

        {verifiedClaims.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
            No evidence-supported claims are available yet.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {verifiedClaims.map((claim, index) => (
              <article
                key={claim.id}
                className="rounded-xl border border-slate-800 bg-slate-950 p-4 md:p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-500">
                    KNOWLEDGE ITEM {String(index + 1).padStart(2, "0")}
                  </span>

                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase text-emerald-400">
                    Supported & Approved
                  </span>
                </div>

                <h4 className="mt-4 text-sm font-semibold leading-7 text-white">
                  {claim.claim_text}
                </h4>

                <div className="mt-4 rounded-lg border-l-2 border-emerald-500 bg-slate-900 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Evidence
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {claim.evidence_quote || "No evidence quote available."}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                  <span>
                    Category: {claim.claim_type || "General"}
                  </span>
                  <span>
                    Source: {claim.evidence_locator?.location || "Not available"}
                  </span>
                  {claim.evidence_locator?.chunk_index !== undefined && (
                    <span>
                      Chunk: {claim.evidence_locator.chunk_index}
                    </span>
                  )}
                </div>

                {claim.reviewer_notes && (
                  <p className="mt-3 border-t border-slate-800 pt-3 text-xs leading-6 text-slate-400">
                    Reviewer notes: {claim.reviewer_notes}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Unresolved Knowledge */}
      {unresolvedClaims.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-5 md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Section 02
              </p>
              <h3 className="mt-2 text-xl font-bold text-white">
                Unresolved Evidence
              </h3>
            </div>

            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
              {unresolvedClaims.length} items
            </span>
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            These claims were approved for inclusion in the handover, but
            their evidence is not marked as supported. They must not be
            treated as confirmed facts.
          </p>

          <div className="mt-5 space-y-3">
            {unresolvedClaims.map((claim, index) => (
              <article
                key={claim.id}
                className="rounded-xl border border-amber-500/15 bg-slate-950 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-500">
                    UNRESOLVED ITEM {index + 1}
                  </span>

                  <span className="rounded-full bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase text-amber-400">
                    {claim.support_status}
                  </span>
                </div>

                <h4 className="mt-3 text-sm font-semibold leading-6 text-white">
                  {claim.claim_text}
                </h4>

                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Evidence: {claim.evidence_quote || "Not available"}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  Source: {claim.evidence_locator?.location || "Not available"}
                </p>

                {claim.reviewer_notes && (
                  <p className="mt-3 text-xs text-slate-400">
                    Reviewer notes: {claim.reviewer_notes}
                  </p>
                )}
              </article>
            ))}
          </div>
        </div>
      )}

      {/* Knowledge Relationships */}
      <div className="rounded-2xl border border-blue-500/20 bg-slate-900/70 p-5 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-blue-400">
              Section 03
            </p>
            <h3 className="mt-2 text-xl font-bold text-white">
              Knowledge Relationships
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Connections between human-approved project claims.
            </p>
          </div>

          <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
            {relationships.length} relationships
          </span>
        </div>

        {relationships.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
            No eligible relationships between approved claims are available.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {relationships.map((relationship) => {
              const confirmed = relationship.review_status === "confirmed";

              return (
                <article
                  key={relationship.id}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-4 md:p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase text-blue-300">
                      {relationshipLabels[relationship.relationship_type] ||
                        relationship.relationship_type}
                    </span>

                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${
                        confirmed
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      {confirmed ? "Human confirmed" : "Awaiting review"}
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Source claim
                      </p>
                      <p className="mt-1 text-sm leading-6 text-white">
                        {getClaimText(relationship.source_claim_id)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-blue-400">
                      <span>↓</span>
                      <span>
                        {relationshipLabels[relationship.relationship_type]}
                      </span>
                      <span>↓</span>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Related claim
                      </p>
                      <p className="mt-1 text-sm leading-6 text-white">
                        {getClaimText(relationship.target_claim_id)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border-l-2 border-blue-500 bg-slate-900 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      AI explanation
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {relationship.explanation}
                    </p>
                  </div>

                  {!confirmed && (
                    <p className="mt-3 text-xs leading-5 text-amber-400">
                      This is an AI-generated suggestion and has not yet
                      been confirmed by a human reviewer.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Review Policy */}
      <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.05] p-5 md:p-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🛡️</span>

          <div>
            <h3 className="font-bold text-white">
              Human approval is mandatory
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              ProjectVault separates AI-generated claims from human-verified
              knowledge. Pending and rejected claims are excluded. Approved
              claims with unresolved evidence are disclosed separately.
              Pending relationships remain clearly labelled as AI suggestions.
            </p>

            <p className="mt-3 text-sm font-bold text-purple-300">
              No approval → No final share.
            </p>
          </div>
        </div>
      </div>

      {/* Download */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 md:p-7">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-blue-400">
              Final Deliverable
            </p>

            <h3 className="mt-2 text-xl font-bold text-white">
              Export your handover report
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Download a structured TXT report containing approved
              knowledge, evidence, relationships and review information.
            </p>
          </div>

          <button
            type="button"
            onClick={downloadReport}
            disabled={claims.length === 0}
            className="shrink-0 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Download Report ↓
          </button>
        </div>

        {generatedAt && (
          <p className="mt-4 text-xs text-emerald-400">
            Report downloaded successfully at{" "}
            {generatedAt.toLocaleTimeString("en-IN")}.
          </p>
        )}

        {claims.length === 0 && (
          <p className="mt-4 text-xs text-amber-400">
            Approve claims in the Knowledge Ledger before exporting a report.
          </p>
        )}
      </div>
    </section>
  );
}
