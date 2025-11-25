import { Octokit } from "@octokit/rest";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ success: false, message: "Method not allowed" })
      };
    }

    const body = JSON.parse(event.body);

    const { repoOwner, repoName, adminPassword, data } = body;

    // -------------------------------
    // 1. Verify admin password
    // -------------------------------
    if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
      return {
        statusCode: 401,
        body: JSON.stringify({ success: false, message: "Unauthorized" })
      };
    }

    // -------------------------------
    // 2. Create GitHub client
    // -------------------------------
    const octokit = new Octokit({
      auth: process.env.GITHUB_PAT
    });

    // Encode repo name for GitHub API (handles spaces)
    const safeRepoName = encodeURIComponent(repoName);

    // -------------------------------
    // 3. Convert updated data.json
    // -------------------------------
    const jsonContent = JSON.stringify(data, null, 2);
    const encodedContent = Buffer.from(jsonContent).toString("base64");

    // -------------------------------
    // 4. Get existing SHA of data.json (required for updating)
    // -------------------------------
    let sha = null;
    try {
      const { data: fileData } = await octokit.repos.getContent({
        owner: repoOwner,
        repo: repoName,
        path: "data.json"
      });
      sha = fileData.sha;
    } catch (err) {
      // File does not exist — sha stays null
    }

    // -------------------------------
    // 5. Commit the updated file
    // -------------------------------
    await octokit.repos.createOrUpdateFileContents({
      owner: repoOwner,
      repo: repoName,
      path: "data.json",
      message: "Update data.json via Netlify function",
      content: encodedContent,
      sha: sha || undefined
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "data.json successfully updated in GitHub.",
        repo: `${repoOwner}/${repoName}`
      })
    };

  } catch (error) {
    console.error("Netlify Function Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: "Server error",
        error: error.message
      })
    };
  }
};
