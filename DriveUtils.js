/**
 * DriveUtils
 * Handles interactions with Google Drive API.
 */
const DriveUtils = {

  fetchCsvData: function(url) {
    const fileId = this._getIdFromUrl(url);
    try {
      const file = DriveApp.getFileById(fileId);
      const csvContent = file.getBlob().getDataAsString();
      return Utilities.parseCsv(csvContent);
    } catch (e) {
      throw new Error(`Failed to read CSV (ID: ${fileId}). Verify the URL.`);
    }
  },

  scanFolder: function(url, notifyCallback) {
    const folderId = this._getIdFromUrl(url);
    let folder;
    
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (e) {
      throw new Error(`Invalid Folder URL (ID: ${folderId}). Ensure it links to a FOLDER.`);
    }

    const fileMap = new Map();
    const files = folder.getFiles();
    let count = 0;

    while (files.hasNext()) {
      const file = files.next();
      // Store cleaned filename mapped to URL
      fileMap.set(StringUtils.clean(file.getName()), file.getUrl());
      
      count++;
      if (count % 100 === 0 && notifyCallback) {
        notifyCallback(`Scanned ${count} files...`);
      }
    }
    return fileMap;
  },

  _getIdFromUrl: function(url) {
    if (!url) return "";
    let cleanUrl = String(url).trim();
    
    // Return if already an ID
    if (/^[a-zA-Z0-9_-]{15,}$/.test(cleanUrl)) return cleanUrl;

    let id = "";
    if (cleanUrl.includes("id=")) {
      id = cleanUrl.split("id=")[1].split("&")[0];
    } else if (cleanUrl.includes("/d/")) {
      id = cleanUrl.split("/d/")[1].split("/")[0];
    } else if (cleanUrl.includes("/folders/")) {
      id = cleanUrl.split("/folders/")[1].split("/")[0].split("?")[0];
    } else {
      id = cleanUrl;
    }
    return id;
  }
};