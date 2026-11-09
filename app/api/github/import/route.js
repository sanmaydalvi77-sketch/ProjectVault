
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const GITHUB_API = "https://api.github.com";
const MAX_IMPORT_SIZE = 500000;

const githubHeaders = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "ProjectVault",
};

function parseGitHubUrl(repoUrl) {
  try {
    const url = new URL(repoUrl);

    if (
      url.protocol !== "https:" ||
      url.hostname !== "github.com"
    ) {
      return null;
    }

    const parts = url.pathname
      .split("/")
      .filter(Boolean);

    if (parts.length !== 2) {
      return null;
    }

    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, "");

    const validName = /^[a-zA-Z0-9_.-]+$/;

    if (
      !validName.test(owner) ||
      !validName.test(repo) ||
      owner === "." ||
      owner === ".." ||
      repo === "." ||
      repo === ".."
    ) {
      return null;
    }

    return { owner, repo };
  } catch {
    return null;
  }
}

async function githubRequest(url) {
  const response = await fetch(url, {
    headers: githubHeaders,
    cache: "no-store",
  });

  if (!response.ok) {
    const error = new Error(
      `GitHub returned status ${response.status}.`
    );

    error.status = response.status;
    throw error;
  }

  return response;
}

export async function POST(request) {
  try {
    // 1. Authenticate the user.
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

    // 2. Read and validate the request.
    const { projectId, repoUrl } = await request.json();

    if (
      typeof projectId !== "string" ||
      typeof repoUrl !== "string" ||
      !projectId.trim() ||
      !repoUrl.trim()
    ) {
      return NextResponse.json(
        { error: "Project ID and GitHub URL are required." },
        { status: 400 }
      );
    }

    const repository = parseGitHubUrl(repoUrl.trim());

    if (!repository) {
      return NextResponse.json(
        {
          error:
            "Enter a valid public GitHub repository URL, such as https://github.com/owner/repository.",
        },
        { status: 400 }
      );
    }

    const { owner, repo } = repository;

    const encodedOwner = encodeURIComponent(owner);
    const encodedRepo = encodeURIComponent(repo);

    // 3. Verify project ownership.
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

    // 4. Retrieve GitHub repository information.
    const repoResponse = await githubRequest(
      `${GITHUB_API}/repos/${encodedOwner}/${encodedRepo}`
    );

    const repoData = await repoResponse.json();

    if (repoData.private) {
      return NextResponse.json(
        { error: "Only public repositories are supported." },
        { status: 400 }
      );
    }

    // 5. Retrieve README metadata.
    const readmeResponse = await githubRequest(
      `${GITHUB_API}/repos/${encodedOwner}/${encodedRepo}/readme`
    );

    const readmeData = await readmeResponse.json();

    if (!readmeData.download_url) {
      return NextResponse.json(
        { error: "Could not locate the repository README." },
        { status: 404 }
      );
    }

    // 6. Download README text.
    const rawReadmeResponse = await fetch(
      readmeData.download_url,
      {
        cache: "no-store",
      }
    );

    if (!rawReadmeResponse.ok) {
      return NextResponse.json(
        { error: "Unable to download the repository README." },
        { status: 502 }
      );
    }

    const readmeText = await rawReadmeResponse.text();

    if (!readmeText.trim()) {
      return NextResponse.json(
        { error: "The repository README is empty." },
        { status: 422 }
      );
    }

    // 7. Retrieve the 10 most recent commits.
    const commitsResponse = await githubRequest(
      `${GITHUB_API}/repos/${encodedOwner}/${encodedRepo}/commits?per_page=10`
    );

    const commits = await commitsResponse.json();

    if (!Array.isArray(commits)) {
      throw new Error("Invalid GitHub commit response.");
    }

    const commitText = commits.map((commit, index) => {
      const details = commit.commit;

      return `
Commit ${index + 1}
SHA: ${commit.sha}
Author: ${details.author?.name || "Not available"}
Date: ${details.author?.date || "Not available"}
Message: ${details.message || "No commit message"}
URL: ${commit.html_url}
`;
    }).join("\n");

    // 8. Combine repository information into one document.
    const extractedText = `
PROJECTVAULT GITHUB IMPORT

Repository: ${owner}/${repo}
Repository URL: ${repoData.html_url}
Description: ${repoData.description || "Not provided"}
Default Branch: ${repoData.default_branch}
Stars: ${repoData.stargazers_count}
Forks: ${repoData.forks_count}
Imported At: ${new Date().toISOString()}

==================================================
REPOSITORY README
==================================================

${readmeText}

==================================================
RECENT COMMIT HISTORY
==================================================

${commitText}
`;

    if (extractedText.length > MAX_IMPORT_SIZE) {
      return NextResponse.json(
        {
          error:
            "The imported repository content exceeds the 500,000-character analysis limit.",
        },
        { status: 413 }
      );
    }

    // 9. Save imported repository content in Supabase.
    const documentName =
      `github-${owner}-${repo}-README.md`;

    const storagePath =
      `github/${owner}/${repo}`;

    const { data: savedDocument, error: saveError } =
      await supabase
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
        )
        .select(
          "id, project_id, file_name, extraction_status"
        )
        .single();

    if (saveError) {
      console.error("GitHub import database error:", saveError);

      return NextResponse.json(
        { error: "GitHub content was fetched but could not be saved." },
        { status: 500 }
      );
    }

    // 10. Return imported document details.
    return NextResponse.json({
      success: true,
      message: "GitHub repository imported successfully.",
      repository: `${owner}/${repo}`,
      document: savedDocument,
      documentName,
      commitCount: commits.length,
      characterCount: extractedText.length,
    });
  } catch (error) {
    console.error("GitHub import error:", error);

    if (error.status === 404) {
      return NextResponse.json(
        {
          error:
            "Repository, README, or requested GitHub resource was not found. Check that the repository is public.",
        },
        { status: 404 }
      );
    }

    if (error.status === 403 || error.status === 429) {
      return NextResponse.json(
        {
          error:
            "GitHub API rate limit reached. Please try again later.",
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error:
          error.message || "GitHub repository import failed.",
      },
      { status: 500 }
    );
  }
}
