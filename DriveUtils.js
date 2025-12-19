/**
 * DriveUtils.js
 * Handles interactions with Google Drive.
 */

const DriveUtils = (function() {

  /**
   * Extracts file ID from a Google Drive URL.
   * @param {string} url
   * @returns {string} File ID
   */
  function getFileIdFromUrl(url) {
    let id = "";
    // Regex for various Drive URL formats
    const parts = url.match(/[-\w]{25,}/);
    if (parts && parts.length > 0) {
      id = parts[0];
    } else {
      throw new Error("Invalid Google Drive URL: Could not extract File ID.");
    }
    return id;
  }

  /**
   * Reads file content as a string (UTF-8).
   * @param {string} urlOrId Google Drive URL or File ID
   * @returns {string} File content
   */
  function getFileContent(urlOrId) {
    let fileId = urlOrId;
    if (urlOrId.indexOf('http') !== -1) {
      fileId = getFileIdFromUrl(urlOrId);
    }

    try {
      const file = DriveApp.getFileById(fileId);
      return file.getBlob().getDataAsString();
    } catch (e) {
      throw new Error(`Failed to read file from Drive (ID: ${fileId}): ${e.message}`);
    }
  }

  /**
   * Gets a file blob.
   * @param {string} urlOrId Google Drive URL or File ID
   * @returns {GoogleAppsScript.Base.Blob}
   */
  function getFileBlob(urlOrId) {
    let fileId = urlOrId;
    if (urlOrId.indexOf('http') !== -1) {
      fileId = getFileIdFromUrl(urlOrId);
    }

    try {
      const file = DriveApp.getFileById(fileId);
      return file.getBlob();
    } catch (e) {
      throw new Error(`Failed to get file blob (ID: ${fileId}): ${e.message}`);
    }
  }

  /**
   * Searches for a file in a specific folder by name.
   * @param {string} folderUrlOrId
   * @param {string} fileNamePartial Partial or full name to match.
   * @returns {string} File URL or null if not found.
   */
  function searchFile(folderUrlOrId, fileNamePartial) {
    let folderId = folderUrlOrId;
    if (folderUrlOrId.indexOf('http') !== -1) {
      folderId = getFileIdFromUrl(folderUrlOrId);
    }

    // Log input to help debugging
    console.log(`[DriveUtils] Searching in folder ${folderId} for: "${fileNamePartial}"`);

    let query = "";
    try {
      const folder = DriveApp.getFolderById(folderId);

      // Sanitize input
      const trimmedName = fileNamePartial ? fileNamePartial.toString().trim() : "";
      if (!trimmedName) {
        console.log(`[DriveUtils] Skipped search: Empty filename.`);
        return null;
      }

      // Escape backslashes and single quotes to prevent "Invalid argument: q" errors.
      // Backslashes must be escaped first.
      const safeName = trimmedName.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

      query = `name contains '${safeName}' and trashed = false`;
      console.log(`[DriveUtils] Query: ${query}`);

      const files = folder.searchFiles(query);

      if (files.hasNext()) {
        const file = files.next();
        const url = file.getUrl();
        console.log(`[DriveUtils] Found: ${url}`);
        return url;
      }

      console.log(`[DriveUtils] No file found.`);
      return null;
    } catch (e) {
      // Log more verbose error info
      console.error(`[DriveUtils] Error searching file. Folder: ${folderId}, Query: "${query}", Error: ${e.message}`);
      return null;
    }
  }

  return {
    getFileContent,
    getFileBlob,
    searchFile,
    getFileIdFromUrl
  };

})();
