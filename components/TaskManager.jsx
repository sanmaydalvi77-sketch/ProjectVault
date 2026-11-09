
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const STATUSES = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "completed", label: "Completed" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export default function TaskManager({ projectId }) {
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState("all");

  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    assignedTo: "",
    dueDate: "",
    status: "todo",
    blockedReason: "",
  });

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const {
  data: { user },
} = await supabase.auth.getUser();

setCurrentUserId(user?.id || "");

      const [taskResponse, memberResponse] = await Promise.all([
        fetch(`/api/tasks?projectId=${projectId}`),
        supabase
          .from("project_members")
          .select("user_id, role")
          .eq("project_id", projectId),
      ]);

      const taskResult = await taskResponse.json();

      if (!taskResponse.ok) {
        throw new Error(taskResult.error || "Unable to load tasks.");
      }

      if (memberResponse.error) {
        throw new Error(memberResponse.error.message);
      }

      setTasks(taskResult.tasks || []);
      setMembers(memberResponse.data || []);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function createTask(event) {
    event.preventDefault();

    if (!form.title.trim()) {
      setError("Please enter a task title.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          ...form,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to create task.");
      }

      setForm({
        title: "",
        description: "",
        priority: "medium",
        assignedTo: "",
        dueDate: "",
        status: "todo",
        blockedReason: "",
      });

      setSuccess("Task created successfully.");
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateTask(taskId, updates) {
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId,
          ...updates,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to update task.");
      }

      setTasks((previous) =>
        previous.map((task) =>
          task.id === taskId ? result.task : task
        )
      );

      setSuccess("Task updated successfully.");
    } catch (err) {
      setError(err.message);
      await loadData();
    }
  }

  async function deleteTask(taskId) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this task?"
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/tasks?taskId=${taskId}`,
        { method: "DELETE" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to delete task.");
      }

      setTasks((previous) =>
        previous.filter((task) => task.id !== taskId)
      );

      setSuccess("Task deleted successfully.");
    } catch (err) {
      setError(err.message);
    }
  }

const currentMember = members.find(
  (member) => member.user_id === currentUserId
);

const canDeleteTasks = ["owner", "admin"].includes(
  currentMember?.role
);

const canManageTasks = [
  "owner",
  "admin",
  "contributor",
].includes(currentMember?.role);

  const filteredTasks =
    filter === "all"
      ? tasks
      : tasks.filter((task) => task.status === filter);

  const counts = {
    all: tasks.length,
    todo: tasks.filter((task) => task.status === "todo").length,
    in_progress: tasks.filter(
      (task) => task.status === "in_progress"
    ).length,
    blocked: tasks.filter((task) => task.status === "blocked").length,
    completed: tasks.filter(
      (task) => task.status === "completed"
    ).length,
  };

  function getMemberLabel(userId) {
    const member = members.find(
      (item) => item.user_id === userId
    );

    if (!member) return "Unknown member";

    return `${member.role} · ${userId.slice(0, 8)}`;
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-gray-400">
        Loading project tasks...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-400">
          Project execution
        </p>

        <h2 className="mt-2 text-2xl font-bold text-white">
          Task Management
        </h2>

        <p className="mt-2 text-sm text-gray-400">
          Track responsibilities, deadlines and blockers in one place.
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          {success}
        </div>
      )}

      {/* Task statistics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { key: "all", label: "Total Tasks" },
          { key: "todo", label: "To Do" },
          { key: "in_progress", label: "In Progress" },
          { key: "blocked", label: "Blocked" },
          { key: "completed", label: "Completed" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`rounded-xl border p-4 text-left transition ${
              filter === item.key
                ? "border-indigo-400 bg-indigo-500/15"
                : "border-white/10 bg-white/5 hover:bg-white/10"
            }`}
          >
            <p className="text-xs text-gray-400">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-white">
              {counts[item.key]}
            </p>
          </button>
        ))}
      </div>

{canManageTasks && (
  <>
      {/* Create task form */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 md:p-6">
        <h3 className="text-lg font-semibold text-white">
          Create a new task
        </h3>

        <form onSubmit={createTask} className="mt-5 space-y-4">
          <div>
            <label className="mb-2 block text-sm text-gray-300">
              Task title *
            </label>

            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Example: Complete authentication module"
              required
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-indigo-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-gray-300">
              Description
            </label>

            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              placeholder="Describe what needs to be completed..."
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-indigo-400"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-gray-300">
                Priority
              </label>

              <select
                name="priority"
                value={form.priority}
                onChange={handleChange}
                className="w-full rounded-xl border border-white/10 bg-[#171923] px-4 py-3 text-white"
              >
                {PRIORITIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-300">
                Initial status
              </label>

              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full rounded-xl border border-white/10 bg-[#171923] px-4 py-3 text-white"
              >
                {STATUSES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-300">
                Assign to
              </label>

              <select
                name="assignedTo"
                value={form.assignedTo}
                onChange={handleChange}
                className="w-full rounded-xl border border-white/10 bg-[#171923] px-4 py-3 text-white"
              >
                <option value="">Unassigned</option>

                {members.map((member) => (
                  <option
                    key={member.user_id}
                    value={member.user_id}
                  >
                    {member.role} · {member.user_id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-300">
                Due date
              </label>

              <input
                type="date"
                name="dueDate"
                value={form.dueDate}
                onChange={handleChange}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white"
              />
            </div>
          </div>

          {form.status === "blocked" && (
            <div>
              <label className="mb-2 block text-sm text-gray-300">
                Why is this task blocked?
              </label>

              <textarea
                name="blockedReason"
                value={form.blockedReason}
                onChange={handleChange}
                rows={2}
                placeholder="Explain the blocker..."
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-indigo-500 px-6 py-3 font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Creating..." : "+ Create Task"}
          </button>
        </form>
      </div>
       </>
)}

      {/* Task list */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            Project Tasks
          </h3>

          <span className="text-sm text-gray-400">
            {filteredTasks.length} tasks
          </span>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/20 p-10 text-center">
            <p className="text-gray-300">No tasks found.</p>
            <p className="mt-2 text-sm text-gray-500">
              Create a task to start tracking project work.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <div className="flex flex-col justify-between gap-4 md:flex-row">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-white">
                      {task.title}
                    </h4>

                    {task.description && (
                      <p className="mt-2 text-sm leading-6 text-gray-400">
                        {task.description}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-300">
                        {task.priority.toUpperCase()}
                      </span>

                      {task.due_date && (
                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-300">
                          Due: {task.due_date}
                        </span>
                      )}
                    </div>

                    <p className="mt-3 text-xs text-gray-500">
                      Assigned to:{" "}
                      {task.assigned_to
                        ? getMemberLabel(task.assigned_to)
                        : "Unassigned"}
                    </p>

                    {task.status === "blocked" && (
                      <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                        <p className="text-xs font-semibold text-red-300">
                          BLOCKER
                        </p>
                        <p className="mt-1 text-sm text-red-200">
                          {task.blocked_reason ||
                            "No blocker explanation provided."}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex min-w-[170px] flex-col gap-3">
                    {canManageTasks && (
  <>
                    <select
                      value={task.status}
                      onChange={(event) => {
                        const newStatus = event.target.value;

                        updateTask(task.id, {
                          status: newStatus,
                          ...(newStatus === "blocked"
                            ? {}
                            : { blockedReason: null }),
                        });
                      }}
                      className="w-full rounded-lg border border-white/10 bg-[#171923] px-3 py-2 text-sm text-white"
                    >
                      {STATUSES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>

                    <select
                      value={task.priority}
                      onChange={(event) =>
                        updateTask(task.id, {
                          priority: event.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-white/10 bg-[#171923] px-3 py-2 text-sm text-white"
                    >
                      {PRIORITIES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label} priority
                        </option>
                      ))}
                    </select>

                    <select
                      value={task.assigned_to || ""}
                      onChange={(event) =>
                        updateTask(task.id, {
                          assignedTo: event.target.value || null,
                        })
                      }
                      className="w-full rounded-lg border border-white/10 bg-[#171923] px-3 py-2 text-sm text-white"
                    >
                      <option value="">Unassigned</option>

                      {members.map((member) => (
                        <option
                          key={member.user_id}
                          value={member.user_id}
                        >
                          {member.role} · {member.user_id.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                    </>
)}

                    {canDeleteTasks && (
  <button
    type="button"
    onClick={() => deleteTask(task.id)}
    className="rounded-lg border border-red-500/20 px-3 py-2 text-sm text-red-300 transition hover:bg-red-500/10"
  >
    Delete task
  </button>
)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
