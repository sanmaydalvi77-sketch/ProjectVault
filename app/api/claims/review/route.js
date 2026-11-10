
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ALLOWED_REVIEW_ROLES = ["owner", "admin", "contributor"];

export async function POST(request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { projectId, claimId, reviewStatus, notes } = body;

    if (
      !projectId ||
      !claimId ||
      !["approved", "rejected"].includes(reviewStatus)
    ) {
      return NextResponse.json(
        { error: "Invalid review request." },
        { status: 400 }
      );
    }

    // Verify project ownership or membership.
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("owner_id")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError || !project) {
      return NextResponse.json(
        { error: "Project not found or inaccessible." },
        { status: 404 }
      );
    }

    let role = null;

    if (project.owner_id === user.id) {
      role = "owner";
    } else {
      const { data: membership, error: membershipError } =
        await supabase
          .from("project_members")
          .select("role")
          .eq("project_id", projectId)
          .eq("user_id", user.id)
          .maybeSingle();

      if (membershipError) {
        console.error("Membership lookup error:", membershipError);
      }

      role = membership?.role || null;
    }

    if (!ALLOWED_REVIEW_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "You do not have permission to review claims." },
        { status: 403 }
      );
    }

    // Verify that the claim belongs to this project.
    const { data: claim, error: claimError } = await supabase
      .from("knowledge_claims")
      .select("id")
      .eq("id", claimId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (claimError || !claim) {
      return NextResponse.json(
        { error: "Claim not found in this project." },
        { status: 404 }
      );
    }

    const updates = {
      review_status: reviewStatus,
      reviewer_notes: typeof notes === "string" ? notes : "",
      updated_at: new Date().toISOString(),
    };

    if (reviewStatus === "approved") {
      updates.support_status = "supported";
    }

    const { data, error } = await supabase
      .from("knowledge_claims")
      .update(updates)
      .eq("id", claimId)
      .eq("project_id", projectId)
      .select()
      .single();

    if (error) {
      console.error("Claim review update error:", error);

      return NextResponse.json(
        { error: "Unable to update claim review." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Claim review updated successfully.",
      claim: data,
    });
  } catch (error) {
    console.error("Claim review API error:", error);

    return NextResponse.json(
      { error: "Unable to process claim review." },
      { status: 500 }
    );
  }
}
