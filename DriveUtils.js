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

    try {
      const folder = DriveApp.getFolderById(folderId);
      // We search for files containing the name
      // Note: 'name contains' is case-insensitive usually.
      const files = folder.searchFiles(`name contains '${fileNamePartial}' and trashed = false`);

      if (files.hasNext()) {
        return files.next().getUrl();
      }
      return null;
    } catch (e) {
      console.error(`Error searching file in folder ${folderId}: ${e.message}`);
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
