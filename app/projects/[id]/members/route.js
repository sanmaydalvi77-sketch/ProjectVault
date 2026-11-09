import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_ROLES = ["admin", "contributor", "viewer"];

export async function POST(request, { params }) {
  try {
    const { id: projectId } = await params;

    // 1. Verify the logged-in user.
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "You must be logged in." },
        { status: 401 }
      );
    }

    // 2. Verify project ownership.
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, owner_id")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: "Project not found or access denied." },
        { status: 404 }
      );
    }

    if (project.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Only the project owner can invite members." },
        { status: 403 }
      );
    }

    // 3. Validate invitation details.
    const body = await request.json();

    const email = String(body.email || "").trim().toLowerCase();
    const role = body.role || "contributor";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Invalid member role." },
        { status: 400 }
      );
    }

    // 4. Use the admin client only on the server.
    const admin = createAdminClient();

    const { data: invitation, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email);

    if (inviteError || !invitation?.user) {
      return NextResponse.json(
        {
          error:
            inviteError?.message ||
            "Unable to send invitation. The email may already be registered.",
        },
        { status: 400 }
      );
    }

    // 5. Add the invited user to the project.
    const { error: memberError } = await admin
      .from("project_members")
      .insert({
        project_id: projectId,
        user_id: invitation.user.id,
        role,
        added_by: user.id,
      });

    if (memberError) {
      return NextResponse.json(
        {
          error:
            "Invitation was sent, but adding the project membership failed: " +
            memberError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${email}.`,
    });
  } catch (error) {
    console.error("Member invitation error:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}