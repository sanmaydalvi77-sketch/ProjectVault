
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_ROLES = ["admin", "contributor", "viewer"];

export async function POST(request, { params }) {
  try {
    const { id: projectId } = await params;

    // Verify authenticated user
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

    // Verify project ownership
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

    const body = await request.json();

    const email = String(body.email || "").trim().toLowerCase();
    const role = body.role || "contributor";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Invalid member role." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Check whether this email already belongs to a registered user.
    let existingUser = null;
    let page = 1;

    while (page <= 20) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });

      if (error) {
        throw error;
      }

      const users = data?.users || [];

      existingUser = users.find(
        (item) => item.email?.toLowerCase() === email
      );

      if (existingUser || users.length < 1000) {
        break;
      }

      page++;
    }

    let memberUserId;
    let invitationMessage;

    if (existingUser) {
      // Existing account: add directly to the project.
      memberUserId = existingUser.id;
      invitationMessage = `${email} already has an account and has been added to your project.`;

    } else {
      // New account: send an invitation.
      const { data: invitation, error: inviteError } =
        await admin.auth.admin.inviteUserByEmail(email);

      if (inviteError || !invitation?.user) {
        return NextResponse.json(
          {
            error:
              inviteError?.message || "Unable to send invitation.",
          },
          { status: 400 }
        );
      }

      memberUserId = invitation.user.id;
      invitationMessage = `Invitation sent to ${email}.`;
    }

    // Prevent duplicate membership.
    const { data: existingMembership, error: membershipCheckError } =
      await admin
        .from("project_members")
        .select("user_id")
        .eq("project_id", projectId)
        .eq("user_id", memberUserId)
        .maybeSingle();

    if (membershipCheckError) {
      throw membershipCheckError;
    }

    if (existingMembership) {
      return NextResponse.json(
        { error: "This user is already a project member." },
        { status: 409 }
      );
    }

    // Add membership
    const { error: memberError } = await admin
      .from("project_members")
      .insert({
        project_id: projectId,
        user_id: memberUserId,
        role,
        added_by: user.id,
      });

    if (memberError) {
      throw memberError;
    }

    return NextResponse.json({
      success: true,
      message: invitationMessage,
      memberType: existingUser ? "existing" : "new",
    });

  } catch (error) {
    console.error("Member invitation error:", error);

    return NextResponse.json(
      { error: "Unable to process invitation: " + error.message },
      { status: 500 }
    );
  }
}
