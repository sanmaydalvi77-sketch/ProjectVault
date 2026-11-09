
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function DocumentUploader({ projectId }) {
  const [documents, setDocuments] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [extractingDocument, setExtractingDocument] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [analyzingDocument, setAnalyzingDocument] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const supabase = createClient();

  async function loadDocuments() {
    setLoading(true);
    setError("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("Please log in again to view your documents.");
      setLoading(false);
      return;
    }

    const folderPath = `${user.id}/${projectId}`;

    const { data, error: listError } = await supabase.storage
      .from("project-documents")
      .list(folderPath, {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (listError) {
      setError(listError.message);
    } else {
      setDocuments((data || []).filter((item) => item.id));
    }

    setLoading(false);
  }

  useEffect(() => {
    loadDocuments();
  }, [projectId]);

  function validateFile(file) {
    if (!file) return false;

    const allowedExtensions = [".pdf", ".md", ".txt"];
    const fileName = file.name.toLowerCase();

    const isAllowed = allowedExtensions.some((extension) =>
      fileName.endsWith(extension)
    );

    if (!isAllowed) {
      setError("Only PDF, Markdown and TXT files are allowed.");
      setSelectedFile(null);
      return false;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be 10 MB or less.");
      setSelectedFile(null);
      return false;
    }

    setError("");
    setMessage("");
    setSelectedFile(file);
    return true;
  }

  async function handleUpload(event) {
    event.preventDefault();

    if (!selectedFile || !validateFile(selectedFile)) {
      setError("Please select a valid document first.");
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("Your session could not be verified. Please log in again.");
      setUploading(false);
      return;
    }

    const safeName = selectedFile.name.replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

    const folderPath = `${user.id}/${projectId}`;
    const filePath = `${folderPath}/${crypto.randomUUID()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("project-documents")
      .upload(filePath, selectedFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: selectedFile.type || "application/octet-stream",
      });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    setMessage("Document uploaded successfully! You can now extract and analyze it.");
    setSelectedFile(null);
    setFileInputKey((current) => current + 1);

    await loadDocuments();

    setUploading(false);
  }

  async function handleExtract(document) {
    setExtractingDocument(document.name);
    setExtractedText("");
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/documents/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          documentName: document.name,
        }),
      });

      const responseText = await response.text();

      let result;

      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error(
          `Invalid API response. Status: ${response.status}. ${responseText.slice(0, 300) || "Empty response"}`
        );
      }

      if (!response.ok) {
        throw new Error(result.error || "Text extraction failed.");
      }

      setExtractedText(result.extractedText);

      setMessage(
        `Text extracted successfully! ${result.characterCount} characters found.`
      );
    } catch (error) {
      setError(error.message);
    } finally {
      setExtractingDocument("");
    }
  }

  async function handleAnalyze(document) {
    setAnalyzingDocument(document.name);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/documents/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          documentName: document.name,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "AI analysis failed.");
      }

      setMessage(
        `AI analysis completed! ${result.claimsCreated} claims were saved to your Knowledge Ledger.`
      );
    } catch (error) {
      setError(error.message);
    } finally {
      setAnalyzingDocument("");
    }
  }

  async function handleDownload(document) {
    setError("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("Please log in again to download this document.");
      return;
    }

    const filePath = `${user.id}/${projectId}/${document.name}`;

    const { data, error: downloadError } = await supabase.storage
      .from("project-documents")
      .download(filePath);

    if (downloadError) {
      setError(downloadError.message);
      return;
    }

    const url = URL.createObjectURL(data);
    const link = window.document.createElement("a");

    link.href = url;
    link.download = getDisplayName(document.name);
    link.click();

    URL.revokeObjectURL(url);
  }

  function getDisplayName(name) {
    return name.replace(/^[0-9a-f-]{36}_/i, "");
  }

  function formatSize(bytes) {
    if (!bytes) return "Unknown size";
    return bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function getFileType(name) {
    const extension = name.split(".").pop()?.toLowerCase();

    if (extension === "pdf") return "PDF";
    if (extension === "md") return "MARKDOWN";
    return "TEXT";
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);

    const file = event.dataTransfer.files?.[0];

    if (file) {
      validateFile(file);
    }
  }

  const busy = uploading || extractingDocument !== "" || analyzingDocument !== "";

  return (
    <section className="mt-8 space-y-8">

      {/* Upload Header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">
          Source Management
        </p>

        <h2 className="mt-2 text-2xl font-bold text-white">
          Project Documents
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Upload your project files, extract their content and use AI to
          identify important project knowledge.
        </p>
      </div>

      {/* Upload Area */}
      <form
        onSubmit={handleUpload}
        className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 md:p-7"
      >
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`rounded-2xl border-2 border-dashed p-8 text-center transition md:p-12 ${
            dragActive
              ? "border-blue-400 bg-blue-500/10"
              : "border-slate-700 bg-slate-950/50 hover:border-blue-500/50"
          }`}
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-3xl">
            📤
          </div>

          <h3 className="mt-5 text-lg font-bold text-white">
            {dragActive ? "Drop your file here" : "Upload project documents"}
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Drag and drop a file here, or browse your computer.
          </p>

          <label className="mt-6 inline-flex cursor-pointer items-center rounded-xl border border-blue-500/30 bg-blue-500/10 px-5 py-3 text-sm font-semibold text-blue-400 transition hover:bg-blue-500/20">
            Browse Files

            <input
              key={fileInputKey}
              type="file"
              accept=".pdf,.md,.txt,application/pdf,text/markdown,text/plain"
              className="hidden"
              onChange={(event) =>
                validateFile(event.target.files?.[0] || null)
              }
            />
          </label>

          <p className="mt-5 text-xs text-slate-600">
            Supported: PDF, MD, TXT · Maximum file size: 10 MB
          </p>
        </div>

        {selectedFile && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="text-2xl">📄</span>
              <div className="min-w-0">
                <p className="break-all text-sm font-semibold text-white">
                  {selectedFile.name}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatSize(selectedFile.size)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedFile(null)}
              className="text-sm text-slate-400 hover:text-red-400"
            >
              Remove
            </button>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={uploading || !selectedFile}
            className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? "Uploading document..." : "Upload Document →"}
          </button>

          <span className="text-xs text-slate-500">
            Files are stored in your private project workspace.
          </span>
        </div>
      </form>

      {/* Feedback */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          <span className="font-semibold">Something went wrong: </span>
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400">
          <span className="font-semibold">Success: </span>
          {message}
        </div>
      )}

      {/* Document List */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-white">
              Uploaded Documents
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Your project's source material.
            </p>
          </div>

          <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-300">
            {documents.length} files
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">
            Loading your documents...
          </div>
        ) : documents.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-700 p-9 text-center">
            <div className="text-3xl">📂</div>
            <h4 className="mt-4 font-semibold text-white">
              No documents yet
            </h4>
            <p className="mt-2 text-sm text-slate-500">
              Upload your first source document to begin building your
              project's knowledge base.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {documents.map((document) => (
              <div
                key={document.id}
                className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-700 md:p-5"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-2xl">
                      📄
                    </div>

                    <div className="min-w-0">
                      <h4 className="break-all text-sm font-semibold text-white">
                        {getDisplayName(document.name)}
                      </h4>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-blue-500/10 px-2 py-1 text-[10px] font-bold tracking-wide text-blue-400">
                          {getFileType(document.name)}
                        </span>

                        <span className="text-xs text-slate-600">
                          {formatSize(document.metadata?.size)}
                        </span>

                        <span className="text-xs text-slate-600">
                          {document.created_at
                            ? new Date(document.created_at).toLocaleDateString("en-IN")
                            : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleExtract(document)}
                      disabled={busy}
                      className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-40"
                    >
                      {extractingDocument === document.name
                        ? "Extracting..."
                        : "Extract Text"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAnalyze(document)}
                      disabled={busy}
                      className="rounded-lg border border-purple-500/20 bg-purple-500/10 px-3 py-2 text-xs font-semibold text-purple-400 transition hover:bg-purple-500/20 disabled:opacity-40"
                    >
                      {analyzingDocument === document.name
                        ? "Analyzing..."
                        : "Analyze with AI"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownload(document)}
                      disabled={busy}
                      className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
                    >
                      Download ↓
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Extracted Text Preview */}
      {extractedText && (
        <div className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                Extraction Result
              </p>
              <h3 className="mt-2 text-lg font-bold text-white">
                Extracted Document Text
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setExtractedText("")}
              className="rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              Close ✕
            </button>
          </div>

          <div className="p-5">
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-5 text-sm leading-7 text-slate-300">
              {extractedText}
            </pre>
          </div>
        </div>
      )}

      {/* Workflow Guidance */}
      <div className="rounded-2xl border border-blue-500/15 bg-blue-500/[0.04] p-5">
        <h3 className="font-semibold text-blue-300">
          Your document workflow
        </h3>

        <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="font-semibold text-white">01 · Upload</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Add your source files securely.
            </p>
          </div>

          <div>
            <p className="font-semibold text-white">02 · Extract & Analyze</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Extract text and let AI identify claims.
            </p>
          </div>

          <div>
            <p className="font-semibold text-white">03 · Review</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Verify claims in your Knowledge Ledger.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
