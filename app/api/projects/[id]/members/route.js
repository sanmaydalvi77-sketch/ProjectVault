
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_ROLES = ["admin", "contributor", "viewer"];

async function getProjectAccess(supabase, projectId, userId) {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, owner_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) throw projectError;
  if (!project) return null;

  if (project.owner_id === userId) {
    return { project, currentRole: "owner" };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) return null;

  return {
    project,
    currentRole: membership.role,
  };
}

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

    const access = await getProjectAccess(supabase, projectId, user.id);

    if (!access) {
      return NextResponse.json(
        { error: "Project not found or access denied." },
        { status: 404 }
      );
    }

    // Admin client is used only after project access is verified.
    const admin = createAdminClient();

    const { data: members, error: membersError } = await admin
      .from("project_members")
      .select("user_id, role, joined_at")
      .eq("project_id", projectId)
      .order("joined_at", { ascending: true });

    if (membersError) throw membersError;

    return NextResponse.json({
      members: members || [],
      currentRole: access.currentRole,
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

    const access = await getProjectAccess(supabase, projectId, user.id);

    if (!access) {
      return NextResponse.json(
        { error: "Project not found or access denied." },
        { status: 404 }
      );
    }

    const currentRole = access.currentRole;

    // Only Owners and Admins can invite members.
    if (!["owner", "admin"].includes(currentRole)) {
      return NextResponse.json(
        { error: "Only project owners and admins can invite members." },
        { status: 403 }
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

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

    // Admins cannot invite other Admins.
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

    // Check duplicate membership before sending an invitation.
    if (existingUser) {
      const { data: existingMembership, error: checkError } = await admin
        .from("project_members")
        .select("user_id")
        .eq("project_id", projectId)
        .eq("user_id", existingUser.id)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingMembership) {
        return NextResponse.json(
          { error: "This user is already a project member." },
          { status: 409 }
        );
      }
    }

    let memberUserId;
    let invitationMessage;
    let memberType;

    if (existingUser) {
      memberUserId = existingUser.id;
      memberType = "existing";
      invitationMessage =
        `${email} already has an account and has been added to your project.`;
    } else {
      const { data: invitation, error: inviteError } =
        await admin.auth.admin.inviteUserByEmail(email);

      if (inviteError || !invitation?.user) {
        console.error("Invitation error:", inviteError);

        return NextResponse.json(
          { error: "Unable to send invitation." },
          { status: 400 }
        );
      }

      memberUserId = invitation.user.id;
      memberType = "new";
      invitationMessage = `Invitation sent to ${email}.`;
    }

    // Insert membership using the server-only admin client.
    const { error: memberError } = await admin
      .from("project_members")
      .insert({
        project_id: projectId,
        user_id: memberUserId,
        role,
        added_by: user.id,
      });

    if (memberError) {
      console.error("Membership insert error:", memberError);

      if (memberError.code === "23505") {
        return NextResponse.json(
          { error: "This user is already a project member." },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Invitation was processed, but project membership could not be created. Please check the member list before retrying." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: invitationMessage,
      memberType,
    });
  } catch (error) {
    console.error("Member invitation error:", error);

    return NextResponse.json(
      { error: "Unable to process the invitation. Please try again." },
      { status: 500 }
    );
  }
}
