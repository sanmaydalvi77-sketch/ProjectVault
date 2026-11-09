
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Create a consistent snapshot for comparison.
// Recursively normalize data so object key order
// does not affect snapshot comparison.
function normalizeValue(value) {
  if (Array.isArray(value)) {
    return value
      .map(normalizeValue)
      .sort((a, b) => {
        if (a && b && a.id && b.id) {
          return String(a.id).localeCompare(String(b.id));
        }

        return 0;
      });
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = normalizeValue(value[key]);
        return result;
      }, {});
  }

  return value;
}

function normalizeSnapshot(snapshot) {
  return normalizeValue({
    project_id: snapshot.project_id,
    project_name: snapshot.project_name,
    approved_claims: snapshot.approved_claims || [],
    relationships: snapshot.relationships || [],
    tasks: snapshot.tasks || [],
  });
}

// Fetch the current data that belongs in the handover report.
async function getCurrentSnapshot(supabase, project) {
  const { data: claims, error: claimsError } = await supabase
    .from("knowledge_claims")
    .select(
      "id, claim_text, claim_type, evidence_quote, evidence_locator, support_status, reviewer_notes, created_at"
    )
    .eq("project_id", project.id)
    .eq("review_status", "approved")
    .order("created_at", { ascending: true });

  if (claimsError) throw new Error(claimsError.message);

  const { data: tasks, error: tasksError } = await supabase
    .from("project_tasks")
    .select("*")
    .eq("project_id", project.id)
    .order("created_at", { ascending: true });

  if (tasksError) throw new Error(tasksError.message);

  let relationships = [];

  if (claims?.length > 0) {
    const claimIds = claims.map((claim) => claim.id);

    const { data: relationshipData, error: relationshipError } =
      await supabase
        .from("claim_relationships")
        .select(
          "id, source_claim_id, target_claim_id, relationship_type, explanation, review_status"
        )
        .eq("project_id", project.id)
        .in("source_claim_id", claimIds)
        .in("target_claim_id", claimIds)
        .in("review_status", ["confirmed", "pending"]);

    if (relationshipError) {
      throw new Error(relationshipError.message);
    }

    relationships = relationshipData || [];
  }

  return {
    project_id: project.id,
    project_name: project.name,
    approved_claims: claims || [],
    relationships,
    tasks: tasks || [],
  };
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    // Verify project access.
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name, owner_id")
      .eq("id", id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: "Project not found or access denied." },
        { status: 404 }
      );
    }

    let currentRole = null;

    if (project.owner_id === user.id) {
      currentRole = "owner";
    } else {
      const { data: membership, error: membershipError } =
        await supabase
          .from("project_members")
          .select("role")
          .eq("project_id", id)
          .eq("user_id", user.id)
          .maybeSingle();

      if (membershipError) {
        return NextResponse.json(
          { error: membershipError.message },
          { status: 500 }
        );
      }

      currentRole = membership?.role || null;
    }

    if (!currentRole) {
      return NextResponse.json(
        { error: "You are not a member of this project." },
        { status: 403 }
      );
    }

    const { data: approval, error: approvalError } = await supabase
      .from("handover_approvals")
      .select("*")
      .eq("project_id", id)
      .maybeSingle();

    if (approvalError) {
      return NextResponse.json(
        { error: approvalError.message },
        { status: 500 }
      );
    }

    if (!approval) {
      return NextResponse.json({
        approval: null,
        isCurrent: false,
        currentRole,
      });
    }

    const currentSnapshot = await getCurrentSnapshot(supabase, project);

    const savedSnapshot = normalizeSnapshot(
      approval.report_snapshot || {}
    );

    const liveSnapshot = normalizeSnapshot(currentSnapshot);

    const isCurrent =
      JSON.stringify(savedSnapshot) === JSON.stringify(liveSnapshot);

    return NextResponse.json({
      approval,
      isCurrent,
      currentRole,
    });
  } catch (error) {
    console.error("Handover approval retrieval error:", error);

    return NextResponse.json(
      {
        error:
          error.message || "Unable to retrieve handover approval.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    // Verify project exists.
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name, owner_id")
      .eq("id", id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: "Project not found or access denied." },
        { status: 404 }
      );
    }

    // Determine the user's project role.
    let currentRole = null;

    if (project.owner_id === user.id) {
      currentRole = "owner";
    } else {
      const { data: membership, error: membershipError } =
        await supabase
          .from("project_members")
          .select("role")
          .eq("project_id", id)
          .eq("user_id", user.id)
          .maybeSingle();

      if (membershipError) {
        return NextResponse.json(
          { error: membershipError.message },
          { status: 500 }
        );
      }

      currentRole = membership?.role || null;
    }

    if (!["owner", "admin"].includes(currentRole)) {
      return NextResponse.json(
        {
          error:
            "Only project owners and admins can approve handovers.",
        },
        { status: 403 }
      );
    }

    const currentSnapshot = await getCurrentSnapshot(
      supabase,
      project
    );

    if (
      !currentSnapshot.approved_claims.length &&
      !currentSnapshot.tasks.length
    ) {
      return NextResponse.json(
        {
          error:
            "Add approved knowledge claims or project tasks before approving the handover.",
        },
        { status: 400 }
      );
    }

    // Preserve the exact report data being approved.
    const reportSnapshot = {
      ...currentSnapshot,
      approved_by: user.id,
      approved_by_role: currentRole,
      snapshot_created_at: new Date().toISOString(),
    };

    const now = new Date().toISOString();

    const { data: approval, error: approvalError } = await supabase
      .from("handover_approvals")
      .upsert(
        {
          project_id: id,
          approved_by: user.id,
          approved_at: now,
          report_snapshot: reportSnapshot,
          updated_at: now,
        },
        { onConflict: "project_id" }
      )
      .select("*")
      .single();

    if (approvalError) {
      return NextResponse.json(
        { error: approvalError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Handover approved successfully.",
      approval,
      isCurrent: true,
    });
  } catch (error) {
    console.error("Handover approval error:", error);

    return NextResponse.json(
      {
        error:
          error.message ||
          "An unexpected error occurred while approving the handover.",
      },
      { status: 500 }
    );
  }
}
