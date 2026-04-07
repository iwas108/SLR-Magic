/**
 * DriveUtils.js
 * Handles interactions with Google Drive.
 */

const DriveUtils = (function() {

  /**
   * Extracts file ID from a Google Drive URL, or returns it if it's already an ID.
   * @param {string} urlOrId
   * @returns {string} File ID
   */
  function getFileIdFromUrl(urlOrId) {
    if (!urlOrId) throw new Error("Provided Drive URL or ID is empty.");

    // If it doesn't look like a URL and is long enough, assume it's already an ID from the Picker
    if (urlOrId.indexOf('http') === -1 && urlOrId.length >= 15 && !urlOrId.includes(' ')) {
      return urlOrId;
    }

    let id = "";
    // Regex for various Drive URL formats
    const parts = urlOrId.match(/[-\w]{25,}/);
    if (parts && parts.length > 0) {
      id = parts[0];
    } else {
      throw new Error(`Invalid Google Drive URL or ID: Could not extract ID from "${urlOrId}".`);
    }
    return id;
  }

  /**
   * Reads file content as a string (UTF-8).
   * @param {string} urlOrId Google Drive URL or File ID
   * @returns {string} File content
   */
  function getFileContent(urlOrId) {
    const fileId = getFileIdFromUrl(urlOrId);

    try {
      const file = DriveApp.getFileById(fileId);
      return file.getBlob().getDataAsString();
    } catch (e) {
      throw new Error(`Access Denied or File Not Found. The script lacks permission to read this file (ID: ${fileId}). Please re-select it using the Google Picker in the Configuration menu. Details: ${e.message}`);
    }
  }

  /**
   * Gets a file blob.
   * @param {string} urlOrId Google Drive URL or File ID
   * @returns {GoogleAppsScript.Base.Blob}
   */
  function getFileBlob(urlOrId) {
    const fileId = getFileIdFromUrl(urlOrId);

    try {
      const file = DriveApp.getFileById(fileId);
      return file.getBlob();
    } catch (e) {
      throw new Error(`Access Denied or File Not Found. The script lacks permission to read this file (ID: ${fileId}). Please re-select it using the Google Picker in the Configuration menu. Details: ${e.message}`);
    }
  }

  /**
   * Searches for a file in a specific folder by name.
   * @param {string} folderUrlOrId
   * @param {string} fileNamePartial Partial or full name to match.
   * @returns {string} File URL or null if not found.
   */
  function searchFile(folderUrlOrId, fileNamePartial) {
    const folderId = getFileIdFromUrl(folderUrlOrId);

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

      // DriveApp still largely uses Drive API v2 conventions where 'title' is used instead of 'name'.
      query = `title contains '${safeName}' and trashed = false`;
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

      // If it's likely an access error or missing folder, throw it back up
      if (e.message.includes("No item with the given ID could be found") || e.message.includes("Access denied")) {
        throw new Error(`Access Denied or Folder Not Found. The script lacks permission to read this folder (ID: ${folderId}). Please re-select the PDF Repository using the Google Picker in the Configuration menu. Details: ${e.message}`);
      }
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
