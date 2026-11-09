import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import pdf from "pdf-parse/lib/pdf-parse.js";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    // 1. Verify the logged-in user.
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please log in first." },
        { status: 401 }
      );
    }

    // 2. Read the requested project and document.
    const { projectId, documentName } = await request.json();

    if (
      !projectId ||
      !documentName ||
      typeof projectId !== "string" ||
      typeof documentName !== "string" ||
      documentName.includes("/") ||
      documentName.includes("\\") ||
      documentName.includes("..")
    ) {
      return NextResponse.json(
        { error: "Invalid project or document details." },
        { status: 400 }
      );
    }

    // 3. Verify that this project belongs to the user.
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("owner_id", user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: "Project not found or access denied." },
        { status: 404 }
      );
    }

    // 4. Download the document from private Supabase Storage.
    const filePath = `${user.id}/${projectId}/${documentName}`;

    const { data: file, error: downloadError } = await supabase.storage
      .from("project-documents")
      .download(filePath);

    if (downloadError || !file) {
      return NextResponse.json(
        { error: "Unable to download the document." },
        { status: 400 }
      );
    }

    // 5. Convert the file into a Node.js Buffer.
    const buffer = Buffer.from(await file.arrayBuffer());

    // 6. Extract text according to the file extension.
    const extension = documentName.split(".").pop().toLowerCase();

    let extractedText = "";

    if (extension === "pdf") {
      const parsedPDF = await pdf(buffer);
      extractedText = parsedPDF.text;
    } else if (extension === "md" || extension === "txt") {
      extractedText = buffer.toString("utf-8");
    } else {
      return NextResponse.json(
        { error: "Unsupported document format." },
        { status: 400 }
      );
    }

    if (!extractedText.trim()) {
      return NextResponse.json(
        { error: "No readable text was found in this document." },
        { status: 422 }
      );
    }

    // 7. Return the extracted text.
   // Save extracted text permanently in Supabase.
const storagePath = `${user.id}/${projectId}/${documentName}`;

const { error: saveError } = await supabase
  .from("project_documents")
  .upsert(
    {
      project_id: projectId,
      owner_id: user.id,
      storage_path: storagePath,
      file_name: documentName,
      extracted_text: extractedText,
      extraction_status: "completed",
      extracted_at: new Date().toISOString(),
    },
    {
      onConflict: "project_id,storage_path",
    }
  );

if (saveError) {
  console.error("Document database save error:", saveError);

  return NextResponse.json(
    {
      success: false,
      error: "Text extracted, but saving it to the database failed.",
    },
    { status: 500 }
  );
}

return NextResponse.json({
  success: true,
  documentName,
  extractedText,
  characterCount: extractedText.length,
  savedToDatabase: true,
});
  } catch (error) {
    console.error("Document extraction error:", error);

    return NextResponse.json(
      { error: "Something went wrong while extracting the document." },
      { status: 500 }
    );
  }
}