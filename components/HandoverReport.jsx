
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const relationshipLabels = {
  contradicts: "Contradicts",
  supports: "Supports",
  duplicates: "Duplicates",
  depends_on: "Depends on",
};

const statusLabels = {
  todo: "To Do",
  in_progress: "In Progress",
  blocked: "Blocked",
  completed: "Completed",
};

function formatDate(value) {
  if (!value) return "Not set";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isOverdue(task) {
  if (!task.due_date || task.status === "completed") return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(`${task.due_date}T00:00:00`);
  return dueDate < today;
}

export default function HandoverReport({
  projectId,
  projectName: initialProjectName,
}) {
  const [projectName, setProjectName] = useState(
    initialProjectName || "ProjectVault Project"
  );

  const [claims, setClaims] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState(null);

  // Final handover approval
  const [approval, setApproval] = useState(null);
  const [currentRole, setCurrentRole] = useState(null);
  const [approving, setApproving] = useState(false);
  const [approvalError, setApprovalError] = useState("");
  const [approvalSuccess, setApprovalSuccess] = useState("");

  // Load report data
  useEffect(() => {
    let active = true;

    async function loadReportData() {
      setLoading(true);
      setError("");

      try {
        const supabase = createClient();

        const [
          projectResult,
          claimsResult,
          relationshipsResult,
          taskResponse,
          memberResponse,
          approvalResponse,
        ] = await Promise.all([
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

          fetch(`/api/tasks?projectId=${projectId}`, {
            cache: "no-store",
          }),

          fetch(`/api/projects/${projectId}/members`, {
            cache: "no-store",
          }),

          fetch(`/api/projects/${projectId}/handover-approval`, {
            cache: "no-store",
          }),
        ]);

        if (projectResult.error) {
          throw new Error(projectResult.error.message);
        }

        if (claimsResult.error) {
          throw new Error(claimsResult.error.message);
        }

        if (relationshipsResult.error) {
          throw new Error(relationshipsResult.error.message);
        }

        const taskResult = await taskResponse.json();

        if (!taskResponse.ok) {
          throw new Error(
            taskResult.error || "Unable to load project tasks."
          );
        }

        const memberResult = await memberResponse.json();

        if (!memberResponse.ok) {
          throw new Error(
            memberResult.error || "Unable to load project members."
          );
        }

        const approvalResult = await approvalResponse.json();

        if (!approvalResponse.ok) {
          throw new Error(
            approvalResult.error || "Unable to load handover approval."
          );
        }

        if (!active) return;

        const approvedClaims = claimsResult.data || [];

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

        setProjectName(projectResult.data.name);
        setClaims(approvedClaims);
        setRelationships(relevantRelationships);
        setTasks(taskResult.tasks || []);
        setMembers(memberResult.members || []);

        setCurrentRole(
          approvalResult.currentRole || memberResult.currentRole || null
        );

        setApproval(
          approvalResult.approval
            ? {
                ...approvalResult.approval,
                isCurrent: approvalResult.isCurrent,
              }
            : null
        );
      } catch (err) {
        if (active) {
          setError(
            err.message || "Unable to prepare handover report."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (projectId) {
      loadReportData();
    }

    return () => {
      active = false;
    };
  }, [projectId]);

  // Knowledge analysis
  const verifiedClaims = claims.filter(
    (claim) => claim.support_status === "supported"
  );

  const unresolvedClaims = claims.filter(
    (claim) => claim.support_status !== "supported"
  );

  const conflictingClaims = unresolvedClaims.filter(
    (claim) => claim.support_status === "conflicting"
  );

  const unverifiedClaims = unresolvedClaims.filter(
    (claim) => claim.support_status === "unverified"
  );

  const confirmedRelationships = relationships.filter(
    (relationship) => relationship.review_status === "confirmed"
  );

  const pendingRelationships = relationships.filter(
    (relationship) => relationship.review_status === "pending"
  );

  const confirmedDependencies = confirmedRelationships.filter(
    (relationship) =>
      relationship.relationship_type === "depends_on"
  );

  // Task analysis
  const completedTasks = tasks.filter(
    (task) => task.status === "completed"
  );

  const activeTasks = tasks.filter(
    (task) => task.status === "in_progress"
  );

  const todoTasks = tasks.filter(
    (task) => task.status === "todo"
  );

  const blockedTasks = tasks.filter(
    (task) => task.status === "blocked"
  );

  const overdueTasks = tasks.filter(isOverdue);

  const unassignedTasks = tasks.filter(
    (task) =>
      !task.assigned_to && task.status !== "completed"
  );

  const upcomingTasks = tasks.filter((task) => {
    if (!task.due_date || task.status === "completed") {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = new Date(`${task.due_date}T00:00:00`);
    const daysUntilDue =
      (dueDate - today) / (1000 * 60 * 60 * 24);

    return daysUntilDue >= 0 && daysUntilDue <= 7;
  });

  const completionRate =
    tasks.length === 0
      ? 0
      : Math.round((completedTasks.length / tasks.length) * 100);

  function getMemberLabel(userId) {
    if (!userId) return "Unassigned";

    const member = members.find(
      (item) => item.user_id === userId
    );

    if (!member) {
      return `Member ${userId.slice(0, 8)}`;
    }

    return `${member.role} · ${userId.slice(0, 8)}`;
  }

  function getClaimText(claimId) {
    return (
      claims.find((claim) => claim.id === claimId)?.claim_text ||
      "Claim unavailable"
    );
  }

  // Smart next actions
  const smartNextActions = [];

  if (blockedTasks.length > 0) {
    smartNextActions.push({
      priority: "Critical",
      title: "Resolve blocked project tasks",
      description:
        `${blockedTasks.length} task(s) are blocked. ` +
        "Review their blocker explanations and identify what must happen before work can continue.",
    });
  }

  if (overdueTasks.length > 0) {
    smartNextActions.push({
      priority: "High",
      title: "Address overdue responsibilities",
      description:
        `${overdueTasks.length} unfinished task(s) have passed their deadlines. ` +
        "Contact their owners and establish revised completion dates.",
    });
  }

  if (unassignedTasks.length > 0) {
    smartNextActions.push({
      priority: "High",
      title: "Assign ownership of outstanding work",
      description:
        `${unassignedTasks.length} unfinished task(s) have no assigned owner. ` +
        "Assign a responsible project member before the handover.",
    });
  }

  if (conflictingClaims.length > 0) {
    smartNextActions.push({
      priority: "High",
      title: "Resolve conflicting project information",
      description:
        `${conflictingClaims.length} approved claim(s) have conflicting evidence. ` +
        "Review their sources and establish the correct information.",
    });
  }

  if (unverifiedClaims.length > 0) {
    smartNextActions.push({
      priority: "High",
      title: "Verify outstanding evidence",
      description:
        `${unverifiedClaims.length} approved claim(s) have unverified evidence. ` +
        "Validate their supporting information before relying on them.",
    });
  }

  if (todoTasks.length > 0) {
    smartNextActions.push({
      priority: "Medium",
      title: "Plan outstanding tasks",
      description:
        `${todoTasks.length} task(s) have not been started. ` +
        "Review their priority and deadlines with the incoming contributor.",
    });
  }

  if (upcomingTasks.length > 0) {
    smartNextActions.push({
      priority: "Medium",
      title: "Prepare for upcoming deadlines",
      description:
        `${upcomingTasks.length} unfinished task(s) are due within the next seven days. ` +
        "Ensure their owners have the resources and context required.",
    });
  }

  if (pendingRelationships.length > 0) {
    smartNextActions.push({
      priority: "Medium",
      title: "Review pending knowledge relationships",
      description:
        `${pendingRelationships.length} AI-detected relationship(s) await human review. ` +
        "Confirm or dismiss them in the Knowledge Ledger.",
    });
  }

  if (confirmedDependencies.length > 0) {
    smartNextActions.push({
      priority: "Medium",
      title: "Review project dependencies",
      description:
        `${confirmedDependencies.length} confirmed dependency relationship(s) exist. ` +
        "Understand these connections before modifying related work.",
    });
  }

  function addClaimToReport(lines, claim, index) {
    lines.push(`${index + 1}. ${claim.claim_text}`);
    lines.push(`Category: ${claim.claim_type || "General"}`);
    lines.push(`Evidence status: ${claim.support_status}`);
    lines.push(
      `Evidence: ${claim.evidence_quote || "No evidence quote available."}`
    );
    lines.push(
      `Source: ${claim.evidence_locator?.location || "Not available"}`
    );

    if (claim.reviewer_notes) {
      lines.push(`Reviewer notes: ${claim.reviewer_notes}`);
    }

    lines.push("");
  }

  function addTaskToReport(lines, task, index) {
    lines.push(`${index + 1}. ${task.title}`);
    lines.push(`Description: ${task.description || "Not provided"}`);
    lines.push(`Status: ${statusLabels[task.status] || task.status}`);
    lines.push(`Priority: ${task.priority || "Not specified"}`);
    lines.push(`Owner: ${getMemberLabel(task.assigned_to)}`);
    lines.push(`Due date: ${formatDate(task.due_date)}`);

    if (task.status === "blocked") {
      lines.push(
        `Blocker: ${task.blocked_reason || "No explanation provided"}`
      );
    }

    if (isOverdue(task)) {
      lines.push("Deadline status: OVERDUE");
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
      lines.push(
        `${index + 1}. ${
          relationshipLabels[relationship.relationship_type] ||
          relationship.relationship_type
        }`
      );

      lines.push(
        `Source claim: ${getClaimText(relationship.source_claim_id)}`
      );

      lines.push(
        `Related claim: ${getClaimText(relationship.target_claim_id)}`
      );

      lines.push(
        `Explanation: ${relationship.explanation || "Not provided"}`
      );

      lines.push(`Review status: ${relationship.review_status}`);
      lines.push("");
    });
  }

  // Generate report
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
      "1. PROJECT READINESS SNAPSHOT",
      "--------------------------------------------------",
      `Total tasks: ${tasks.length}`,
      `Completed tasks: ${completedTasks.length}`,
      `In-progress tasks: ${activeTasks.length}`,
      `To-do tasks: ${todoTasks.length}`,
      `Blocked tasks: ${blockedTasks.length}`,
      `Overdue tasks: ${overdueTasks.length}`,
      `Unassigned unfinished tasks: ${unassignedTasks.length}`,
      `Task completion: ${completionRate}%`,
      `Approved knowledge claims: ${claims.length}`,
      `Evidence-supported claims: ${verifiedClaims.length}`,
      `Unresolved evidence claims: ${unresolvedClaims.length}`,
      "",
      "2. COMPLETED TASKS",
      "--------------------------------------------------",
      "",
    ];

    if (completedTasks.length === 0) {
      lines.push("No completed tasks recorded.");
      lines.push("");
    }

    completedTasks.forEach((task, index) => {
      addTaskToReport(lines, task, index);
    });

    lines.push("3. OUTSTANDING PROJECT TASKS");
    lines.push("--------------------------------------------------");
    lines.push("");

    const outstandingTasks = tasks.filter(
      (task) => task.status !== "completed"
    );

    if (outstandingTasks.length === 0) {
      lines.push("No outstanding tasks recorded.");
      lines.push("");
    }

    outstandingTasks.forEach((task, index) => {
      addTaskToReport(lines, task, index);
    });

    lines.push("4. VERIFIED PROJECT KNOWLEDGE");
    lines.push("--------------------------------------------------");
    lines.push("");

    if (verifiedClaims.length === 0) {
      lines.push("No evidence-supported claims are available.");
      lines.push("");
    }

    verifiedClaims.forEach((claim, index) => {
      addClaimToReport(lines, claim, index);
    });

    lines.push("5. UNRESOLVED EVIDENCE");
    lines.push("--------------------------------------------------");
    lines.push("");

    if (unresolvedClaims.length === 0) {
      lines.push("No unresolved approved claims.");
      lines.push("");
    }

    unresolvedClaims.forEach((claim, index) => {
      addClaimToReport(lines, claim, index);
    });

    addRelationshipsToReport(
      lines,
      confirmedRelationships,
      "6. CONFIRMED KNOWLEDGE RELATIONSHIPS"
    );

    addRelationshipsToReport(
      lines,
      pendingRelationships,
      "7. RELATIONSHIPS AWAITING HUMAN REVIEW"
    );

    lines.push("8. SMART NEXT ACTIONS");
    lines.push("--------------------------------------------------");
    lines.push("");

    if (smartNextActions.length === 0) {
      lines.push(
        "No immediate actions identified from the available project data."
      );
      lines.push("");
    }

    smartNextActions.forEach((action, index) => {
      lines.push(
        `${index + 1}. [${action.priority}] ${action.title}`
      );
      lines.push(action.description);
      lines.push("");
    });

    lines.push("9. REVIEW POLICY");
    lines.push("--------------------------------------------------");

    lines.push(
      "Only human-approved knowledge claims are included."
    );

    lines.push(
      "Evidence-supported claims are distinguished from unresolved claims."
    );

    lines.push(
      "AI-generated relationship suggestions are not treated as confirmed conclusions."
    );

    lines.push(
      "Task status and completion do not independently establish knowledge verification."
    );

    lines.push(
      "Task ownership reflects the assignment recorded in ProjectVault at report generation."
    );

    lines.push("");

    lines.push("Generated by ProjectVault.");
    lines.push(
      "This report is an operational snapshot, not final handover approval."
    );

    lines.push("No approval -> No final share.");

    return lines.join("\n");
  }

  // Approve final handover
  async function handleApproveHandover() {
    setApproving(true);
    setApprovalError("");
    setApprovalSuccess("");

    try {
      const response = await fetch(
        `/api/projects/${projectId}/handover-approval`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to approve handover."
        );
      }

      setApproval({
        ...result.approval,
        isCurrent: result.isCurrent,
      });

      setApprovalSuccess(
        "Handover approved successfully. The approval is now recorded."
      );
    } catch (err) {
      setApprovalError(
        err.message || "Something went wrong while approving."
      );
    } finally {
      setApproving(false);
    }
  }

  // Download report
  function downloadReport() {
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
          A unified transition snapshot connecting verified knowledge,
          project responsibilities, unfinished work and operational risks.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Project cover */}
      <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-950 via-slate-900 to-purple-950 p-6 md:p-9">
        <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-blue-300">
          ProjectVault · Handover Snapshot
        </span>

        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">
          Project transition document
        </p>

        <h3 className="mt-3 break-words text-3xl font-bold text-white md:text-4xl">
          {projectName}
        </h3>

        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
          Understand what has been completed, what remains,
          who owns the work and which knowledge still needs attention.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-6 border-t border-white/10 pt-6 md:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Total tasks</p>
            <p className="mt-1 text-2xl font-bold text-white">
              {tasks.length}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500">Completed</p>
            <p className="mt-1 text-2xl font-bold text-emerald-400">
              {completedTasks.length}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500">Blocked</p>
            <p className="mt-1 text-2xl font-bold text-red-400">
              {blockedTasks.length}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500">Verified claims</p>
            <p className="mt-1 text-2xl font-bold text-blue-300">
              {verifiedClaims.length}
            </p>
          </div>
        </div>
      </div>

      {/* Operational readiness */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 md:p-7">
        <p className="text-xs font-bold uppercase tracking-wider text-cyan-400">
          Section 01
        </p>

        <h3 className="mt-2 text-xl font-bold text-white">
          Operational Readiness Snapshot
        </h3>

        <p className="mt-2 text-sm text-slate-400">
          A factual snapshot of current execution. This is not a final
          handover approval or an AI-generated quality score.
        </p>

        <div className="mt-5">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Task completion</span>
            <span className="font-bold text-white">
              {completionRate}%
            </span>
          </div>

          <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            {
              label: "To Do",
              count: todoTasks.length,
              color: "text-slate-300",
            },
            {
              label: "In Progress",
              count: activeTasks.length,
              color: "text-blue-400",
            },
            {
              label: "Blocked",
              count: blockedTasks.length,
              color: "text-red-400",
            },
            {
              label: "Overdue",
              count: overdueTasks.length,
              color: "text-amber-400",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-slate-800 bg-slate-950 p-4"
            >
              <p className="text-xs text-slate-500">{item.label}</p>
              <p className={`mt-2 text-2xl font-bold ${item.color}`}>
                {item.count}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-amber-500/10 px-3 py-2 text-amber-300">
            {unassignedTasks.length} unassigned
          </span>

          <span className="rounded-full bg-cyan-500/10 px-3 py-2 text-cyan-300">
            {upcomingTasks.length} deadlines within 7 days
          </span>

          <span className="rounded-full bg-purple-500/10 px-3 py-2 text-purple-300">
            {members.length} project members
          </span>
        </div>
      </div>

      {/* Task transition */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 md:p-7">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-400">
          Section 02
        </p>

        <h3 className="mt-2 text-xl font-bold text-white">
          Task Transition & Ownership
        </h3>

        <p className="mt-2 text-sm text-slate-400">
          The incoming contributor can identify unfinished responsibilities,
          their current owners, deadlines and blockers.
        </p>

        {tasks.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
            No project tasks have been recorded.
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            {tasks.map((task) => (
              <article
                key={task.id}
                className="rounded-xl border border-slate-800 bg-slate-950 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="font-semibold text-white">
                      {task.title}
                    </h4>

                    {task.description && (
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {task.description}
                      </p>
                    )}
                  </div>

                  <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
                    {statusLabels[task.status] || task.status}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-white/5 px-3 py-2 text-slate-300">
                    Priority: {task.priority}
                  </span>

                  <span className="rounded-full bg-white/5 px-3 py-2 text-slate-300">
                    Owner: {getMemberLabel(task.assigned_to)}
                  </span>

                  <span className="rounded-full bg-white/5 px-3 py-2 text-slate-300">
                    Due: {formatDate(task.due_date)}
                  </span>

                  {isOverdue(task) && (
                    <span className="rounded-full bg-red-500/10 px-3 py-2 text-red-300">
                      Overdue
                    </span>
                  )}
                </div>

                {task.status === "blocked" && (
                  <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                    <p className="text-xs font-bold uppercase text-red-400">
                      Blocker
                    </p>

                    <p className="mt-2 text-sm leading-6 text-red-200">
                      {task.blocked_reason ||
                        "No blocker explanation has been recorded."}
                    </p>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Knowledge summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            Evidence-supported knowledge
          </p>

          <p className="mt-3 text-3xl font-bold text-white">
            {verifiedClaims.length}
          </p>

          <p className="mt-2 text-sm text-slate-400">
            Approved claims whose evidence is marked supported.
          </p>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Unresolved knowledge
          </p>

          <p className="mt-3 text-3xl font-bold text-white">
            {unresolvedClaims.length}
          </p>

          <p className="mt-2 text-sm text-slate-400">
            Approved claims with unverified or conflicting evidence.
          </p>
        </div>
      </div>

      {/* Verified knowledge */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 md:p-7">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
          Section 03
        </p>

        <h3 className="mt-2 text-xl font-bold text-white">
          Verified Project Knowledge
        </h3>

        {verifiedClaims.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
            No evidence-supported claims are available yet.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {verifiedClaims.map((claim, index) => (
              <article
                key={claim.id}
                className="rounded-xl border border-slate-800 bg-slate-950 p-4"
              >
                <p className="text-xs font-semibold text-slate-500">
                  KNOWLEDGE ITEM {String(index + 1).padStart(2, "0")}
                </p>

                <h4 className="mt-3 text-sm font-semibold leading-7 text-white">
                  {claim.claim_text}
                </h4>

                <div className="mt-4 rounded-lg border-l-2 border-emerald-500 bg-slate-900 p-4">
                  <p className="text-[10px] font-bold uppercase text-slate-500">
                    Evidence
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {claim.evidence_quote || "No evidence quote available."}
                  </p>
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  Category: {claim.claim_type || "General"} · Source:{" "}
                  {claim.evidence_locator?.location || "Not available"}
                </p>

                {claim.reviewer_notes && (
                  <p className="mt-3 text-xs leading-6 text-slate-400">
                    Reviewer notes: {claim.reviewer_notes}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Unresolved knowledge */}
      {unresolvedClaims.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-5 md:p-7">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
            Section 04
          </p>

          <h3 className="mt-2 text-xl font-bold text-white">
            Unresolved Evidence
          </h3>

          <div className="mt-5 space-y-3">
            {unresolvedClaims.map((claim) => (
              <article
                key={claim.id}
                className="rounded-xl border border-amber-500/15 bg-slate-950 p-4"
              >
                <span className="rounded-full bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase text-amber-400">
                  {claim.support_status}
                </span>

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

      {/* Relationships */}
      <div className="rounded-2xl border border-blue-500/20 bg-slate-900/70 p-5 md:p-7">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-400">
          Section 05
        </p>

        <h3 className="mt-2 text-xl font-bold text-white">
          Knowledge Relationships
        </h3>

        {relationships.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
            No eligible relationships are available.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {relationships.map((relationship) => {
              const confirmed =
                relationship.review_status === "confirmed";

              return (
                <article
                  key={relationship.id}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-300">
                      {relationshipLabels[relationship.relationship_type] ||
                        relationship.relationship_type}
                    </span>

                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-bold ${
                        confirmed
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      {confirmed ? "Human confirmed" : "Awaiting review"}
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-white">
                    {getClaimText(relationship.source_claim_id)}
                  </p>

                  <p className="my-2 text-xs text-blue-400">
                    ↓ {relationshipLabels[relationship.relationship_type]} ↓
                  </p>

                  <p className="text-sm leading-6 text-white">
                    {getClaimText(relationship.target_claim_id)}
                  </p>

                  <p className="mt-4 rounded-lg bg-slate-900 p-3 text-sm leading-6 text-slate-400">
                    {relationship.explanation || "No explanation provided."}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Smart next actions */}
      <div className="rounded-2xl border border-cyan-500/20 bg-slate-900/70 p-5 md:p-7">
        <p className="text-xs font-bold uppercase tracking-wider text-cyan-400">
          Section 06
        </p>

        <h3 className="mt-2 text-xl font-bold text-white">
          Smart Next Actions
        </h3>

        <p className="mt-2 text-sm text-slate-400">
          Recommendations generated from outstanding tasks, deadlines,
          blockers and knowledge review status.
        </p>

        {smartNextActions.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-emerald-400">
            No immediate actions identified from the available data.
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            {smartNextActions.map((action, index) => (
              <article
                key={action.title}
                className="rounded-xl border border-slate-800 bg-slate-950 p-4"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-500">
                    ACTION {String(index + 1).padStart(2, "0")}
                  </span>

                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${
                      action.priority === "Critical"
                        ? "bg-red-500/10 text-red-400"
                        : action.priority === "High"
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-blue-500/10 text-blue-400"
                    }`}
                  >
                    {action.priority} priority
                  </span>
                </div>

                <h4 className="mt-3 text-sm font-bold text-white">
                  {action.title}
                </h4>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {action.description}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Approval policy and final handover approval */}
      <div className="rounded-2xl border border-purple-500/20 bg-purple-500/[0.05] p-5 md:p-6">
        <h3 className="font-bold text-white">
          Human approval is mandatory
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          ProjectVault separates AI-generated claims from human-reviewed
          knowledge. Unresolved evidence remains visible. AI-generated
          relationships are not treated as confirmed conclusions.
          Task completion does not independently establish knowledge
          verification.
        </p>

        <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Final handover approval
          </p>

          {!approval && (
            <>
              <p className="mt-3 text-sm font-bold text-amber-400">
                Approval pending
              </p>

              <p className="mt-2 text-sm text-slate-400">
                This handover has not yet received final approval.
              </p>
            </>
          )}

          {approval && approval.isCurrent === true && (
            <>
              <p className="mt-3 text-sm font-bold text-green-400">
                ✓ Handover approved — current
              </p>

              <p className="mt-2 text-sm text-slate-300">
                Approved on:{" "}
                {new Date(approval.approved_at).toLocaleString("en-IN")}
              </p>

              <p className="mt-1 break-all text-xs text-slate-500">
                Approver ID: {approval.approved_by}
              </p>
            </>
          )}

          {approval && approval.isCurrent === false && (
            <>
              <p className="mt-3 text-sm font-bold text-amber-400">
                ⚠ Previous approval is outdated
              </p>

              <p className="mt-2 text-sm text-slate-400">
                Project data has changed since the last approval.
                A fresh approval is required.
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Previous approval:{" "}
                {new Date(approval.approved_at).toLocaleString("en-IN")}
              </p>
            </>
          )}

          {(currentRole === "owner" || currentRole === "admin") && (
            <button
              type="button"
              onClick={handleApproveHandover}
              disabled={approving}
              className="mt-5 rounded-xl bg-purple-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {approving
                ? "Processing approval..."
                : approval
                ? "Approve / Re-approve Handover"
                : "Approve Final Handover"}
            </button>
          )}

          {currentRole !== "owner" &&
            currentRole !== "admin" && (
              <p className="mt-4 text-xs text-slate-500">
                Only project owners and admins can approve the final handover.
              </p>
            )}

          {approvalError && (
            <p className="mt-3 text-sm text-red-400">
              {approvalError}
            </p>
          )}

          {approvalSuccess && (
            <p className="mt-3 text-sm text-green-400">
              {approvalSuccess}
            </p>
          )}
        </div>

        <p className="mt-4 text-sm font-bold text-purple-300">
          No approval → No final share.
        </p>
      </div>

      {/* Download */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 md:p-7">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-400">
          Handover Deliverable
        </p>

        <h3 className="mt-2 text-xl font-bold text-white">
          Export project transition report
        </h3>

        <p className="mt-2 text-sm text-slate-400">
          Download tasks, ownership, deadlines, blockers, evidence,
          relationships and recommended next actions.
        </p>

        <button
          type="button"
          onClick={downloadReport}
          className="mt-5 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-blue-500"
        >
          Download Report ↓
        </button>

        {generatedAt && (
          <p className="mt-4 text-xs text-emerald-400">
            Report downloaded at{" "}
            {generatedAt.toLocaleTimeString("en-IN")}.
          </p>
        )}
      </div>
    </section>
  );
}
