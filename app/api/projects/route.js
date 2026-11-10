import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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

    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : "";

    if (!name) {
      return NextResponse.json(
        { error: "Project name is required." },
        { status: 400 }
      );
    }

    if (name.length > 120 || description.length > 1000) {
      return NextResponse.json(
        { error: "Project name or description is too long." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("projects")
      .insert({
        name,
        description,
        owner_id: user.id,
      })
      .select("id, name, description, created_at")
      .single();

    if (error) {
      console.error("Project creation error:", error);

      return NextResponse.json(
        { error: "Unable to create project." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Project created successfully.",
        project: data,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Project API error:", error);

    return NextResponse.json(
      { error: "Unable to process project creation." },
      { status: 500 }
    );
  }
}