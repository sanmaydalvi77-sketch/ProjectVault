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
    const { projectId, relationshipId, reviewStatus } = body;

    if (
      !projectId ||
      !relationshipId ||
      !["confirmed", "dismissed"].includes(reviewStatus)
    ) {
      return NextResponse.json(
        { error: "Invalid relationship review request." },
        { status: 400 }
      );
    }

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
        { error: "You do not have permission to review relationships." },
        { status: 403 }
      );
    }

    const { data: relationship, error: relationshipError } =
      await supabase
        .from("claim_relationships")
        .select("id")
        .eq("id", relationshipId)
        .eq("project_id", projectId)
        .maybeSingle();

    if (relationshipError || !relationship) {
      return NextResponse.json(
        { error: "Relationship not found in this project." },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from("claim_relationships")
      .update({ review_status: reviewStatus })
      .eq("id", relationshipId)
      .eq("project_id", projectId)
      .select()
      .single();

    if (error) {
      console.error("Relationship review update error:", error);

      return NextResponse.json(
        { error: "Unable to update relationship review." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Relationship review updated successfully.",
      relationship: data,
    });
  } catch (error) {
    console.error("Relationship review API error:", error);

    return NextResponse.json(
      { error: "Unable to process relationship review." },
      { status: 500 }
    );
  }
}