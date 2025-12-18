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

  return {
    getFileContent
  };

})();
