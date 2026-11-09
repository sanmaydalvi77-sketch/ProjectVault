
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const VALID_STATUSES = [
  "todo",
  "in_progress",
  "blocked",
  "completed",
];

const VALID_PRIORITIES = [
  "low",
  "medium",
  "high",
  "urgent",
];

async function getAuthenticatedClient() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, user: null };
  }

  return { supabase, user };
}

// GET: Fetch project tasks with their linked knowledge claims.
export async function GET(request) {
  try {
    const { supabase, user } = await getAuthenticatedClient();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("project_tasks")
      .select(`
        *,
        linked_claim:knowledge_claims!project_tasks_linked_claim_id_fkey (
          id,
          claim_text,
          claim_type,
          evidence_quote,
          evidence_locator,
          support_status,
          review_status
        )
      `)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Task retrieval error:", error);

      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      tasks: data || [],
    });
  } catch (error) {
    console.error("Task GET error:", error);

    return NextResponse.json(
      { error: error.message || "Unable to fetch tasks." },
      { status: 500 }
    );
  }
}

// POST: Create a task with an optional knowledge claim link.
export async function POST(request) {
  try {
    const { supabase, user } = await getAuthenticatedClient();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const {
      projectId,
      title,
      description,
      priority,
      assignedTo,
      dueDate,
      status,
      blockedReason,
      linkedClaimId,
    } = body;

    if (
      !projectId ||
      typeof title !== "string" ||
      !title.trim()
    ) {
      return NextResponse.json(
        { error: "Project ID and task title are required." },
        { status: 400 }
      );
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: "Invalid task status." },
        { status: 400 }
      );
    }

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return NextResponse.json(
        { error: "Invalid task priority." },
        { status: 400 }
      );
    }

    // Verify that the selected claim belongs to this project.
    if (linkedClaimId) {
      const { data: claim, error: claimError } = await supabase
        .from("knowledge_claims")
        .select("id")
        .eq("id", linkedClaimId)
        .eq("project_id", projectId)
        .maybeSingle();

      if (claimError || !claim) {
        return NextResponse.json(
          {
            error:
              "The linked knowledge claim was not found in this project.",
          },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from("project_tasks")
      .insert({
        project_id: projectId,
        title: title.trim(),
        description: description || "",
        status: status || "todo",
        priority: priority || "medium",
        assigned_to: assignedTo || null,
        due_date: dueDate || null,
        blocked_reason: blockedReason || null,
        linked_claim_id: linkedClaimId || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Task creation error:", error);

      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        message: "Task created successfully.",
        task: data,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Task POST error:", error);

    return NextResponse.json(
      { error: error.message || "Unable to create task." },
      { status: 500 }
    );
  }
}

// PATCH: Update a task securely.
export async function PATCH(request) {
  try {
    const { supabase, user } = await getAuthenticatedClient();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { taskId } = body;

    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required." },
        { status: 400 }
      );
    }

    // 1. Fetch the existing task and its project.
    const { data: existingTask, error: taskError } = await supabase
      .from("project_tasks")
      .select("id, project_id")
      .eq("id", taskId)
      .maybeSingle();

    if (taskError || !existingTask) {
      return NextResponse.json(
        { error: "Task not found or inaccessible." },
        { status: 404 }
      );
    }

    const updates = {};

    if (body.title !== undefined) {
      if (
        typeof body.title !== "string" ||
        !body.title.trim()
      ) {
        return NextResponse.json(
          { error: "Task title cannot be empty." },
          { status: 400 }
        );
      }

      updates.title = body.title.trim();
    }

    if (body.description !== undefined) {
      updates.description = body.description;
    }

    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json(
          { error: "Invalid task status." },
          { status: 400 }
        );
      }

      updates.status = body.status;
      updates.completed_at =
        body.status === "completed"
          ? new Date().toISOString()
          : null;
    }

    if (body.priority !== undefined) {
      if (!VALID_PRIORITIES.includes(body.priority)) {
        return NextResponse.json(
          { error: "Invalid task priority." },
          { status: 400 }
        );
      }

      updates.priority = body.priority;
    }

    if (body.assignedTo !== undefined) {
      updates.assigned_to = body.assignedTo || null;
    }

    if (body.dueDate !== undefined) {
      updates.due_date = body.dueDate || null;
    }

    if (body.blockedReason !== undefined) {
      updates.blocked_reason = body.blockedReason || null;
    }

    // 2. Validate the linked claim against the task's project.
    if (body.linkedClaimId !== undefined) {
      if (body.linkedClaimId) {
        const { data: claim, error: claimError } = await supabase
          .from("knowledge_claims")
          .select("id")
          .eq("id", body.linkedClaimId)
          .eq("project_id", existingTask.project_id)
          .maybeSingle();

        if (claimError || !claim) {
          return NextResponse.json(
            {
              error:
                "The linked knowledge claim does not belong to this task's project.",
            },
            { status: 400 }
          );
        }

        updates.linked_claim_id = body.linkedClaimId;
      } else {
        // Allow removing an existing knowledge claim link.
        updates.linked_claim_id = null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No task updates were provided." },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    // 3. Update only the verified task.
    const { data, error } = await supabase
      .from("project_tasks")
      .update(updates)
      .eq("id", taskId)
      .eq("project_id", existingTask.project_id)
      .select()
      .single();

    if (error) {
      console.error("Task update error:", error);

      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: "Task updated successfully.",
      task: data,
    });
  } catch (error) {
    console.error("Task PATCH error:", error);

    return NextResponse.json(
      { error: error.message || "Unable to update task." },
      { status: 500 }
    );
  }
}

// DELETE: Delete a task.
export async function DELETE(request) {
  try {
    const { supabase, user } = await getAuthenticatedClient();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("project_tasks")
      .delete()
      .eq("id", taskId);

    if (error) {
      console.error("Task deletion error:", error);

      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: "Task deleted successfully.",
    });
  } catch (error) {
    console.error("Task DELETE error:", error);

    return NextResponse.json(
      { error: error.message || "Unable to delete task." },
      { status: 500 }
    );
  }
}
