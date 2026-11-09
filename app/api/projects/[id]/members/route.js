
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_ROLES = ["admin", "contributor", "viewer"];


export async function GET(request, { params }) {
  try {
    const { id: projectId } = await params;
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

    let currentRole = "viewer";

    if (project.owner_id === user.id) {
      currentRole = "owner";
    } else {
      const { data: membership, error: membershipError } =
        await supabase
          .from("project_members")
          .select("role")
          .eq("project_id", projectId)
          .eq("user_id", user.id)
          .maybeSingle();

      if (membershipError) throw membershipError;

      if (!membership) {
        return NextResponse.json(
          { error: "You are not a member of this project." },
          { status: 403 }
        );
      }

      currentRole = membership.role;
    }

    // Use the admin client only after verifying membership.
    const admin = createAdminClient();

    const { data: members, error: membersError } = await admin
      .from("project_members")
      .select("user_id, role, joined_at")
      .eq("project_id", projectId)
      .order("joined_at", { ascending: true });

    if (membersError) throw membersError;

    return NextResponse.json({
      members: members || [],
      currentRole,
    });
  } catch (error) {
    console.error("Member list error:", error);

    return NextResponse.json(
      { error: "Unable to load project members." },
      { status: 500 }
    );
  }
}


export async function POST(request, { params }) {
  try {
    const { id: projectId } = await params;
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

    // Verify that the project exists.
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

    // Determine the current user's project role.
    let currentRole = "viewer";

    if (project.owner_id === user.id) {
      currentRole = "owner";
    } else {
      const { data: membership, error: membershipError } =
        await supabase
          .from("project_members")
          .select("role")
          .eq("project_id", projectId)
          .eq("user_id", user.id)
          .maybeSingle();

      if (membershipError) {
        throw membershipError;
      }

      currentRole = membership?.role || "viewer";
    }

    // Only owners and admins can invite members.
    if (!["owner", "admin"].includes(currentRole)) {
      return NextResponse.json(
        { error: "Only project owners and admins can invite members." },
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

    // Prevent an admin from creating another admin.
    if (currentRole === "admin" && role === "admin") {
      return NextResponse.json(
        { error: "Only the project owner can invite another admin." },
        { status: 403 }
      );
    }

    const admin = createAdminClient();

    // Find an existing registered account.
    let existingUser = null;
    let page = 1;

    while (page <= 20) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });

      if (error) throw error;

      const users = data?.users || [];

      existingUser = users.find(
        (item) => item.email?.toLowerCase() === email
      );

      if (existingUser || users.length < 1000) break;

      page++;
    }

    let memberUserId;
    let invitationMessage;

    if (existingUser) {
      memberUserId = existingUser.id;
      invitationMessage =
        `${email} already has an account and has been added to your project.`;
    } else {
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
    const { data: existingMembership, error: checkError } =
      await admin
        .from("project_members")
        .select("user_id")
        .eq("project_id", projectId)
        .eq("user_id", memberUserId)
        .maybeSingle();

    if (checkError) throw checkError;

    if (existingMembership) {
      return NextResponse.json(
        { error: "This user is already a project member." },
        { status: 409 }
      );
    }

    // Add the member using the server-only admin client.
    const { error: memberError } = await admin
      .from("project_members")
      .insert({
        project_id: projectId,
        user_id: memberUserId,
        role,
        added_by: user.id,
      });

    if (memberError) throw memberError;

    return NextResponse.json({
      success: true,
      message: invitationMessage,
      memberType: existingUser ? "existing" : "new",
    });
  } catch (error) {
    console.error("Member invitation error:", error);

    return NextResponse.json(
      {
        error: "Unable to process invitation: " + error.message,
      },
      { status: 500 }
    );
  }
}
