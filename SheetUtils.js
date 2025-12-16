/**
 * SheetUtils
 * Handles reading/writing to the Screening Sheet.
 */
const SheetUtils = {

  updatePdfLinks: function(ss, titleToFilenameMap, folderFileMap) {
    const sheet = ss.getSheetByName(CONSTANTS.SHEET_SCREENING);
    if (!sheet) throw new Error(`Sheet "${CONSTANTS.SHEET_SCREENING}" is missing.`);

    const dataRange = sheet.getDataRange();
    const data = dataRange.getValues();
    const headers = data[0].map(h => String(h).toLowerCase());

    const titleIdx = headers.indexOf(CONSTANTS.HEADER_TITLE.toLowerCase());
    const pdfIdx = headers.indexOf(CONSTANTS.HEADER_PDF.toLowerCase());

    if (titleIdx === -1) throw new Error(`Column "${CONSTANTS.HEADER_TITLE}" missing.`);
    if (pdfIdx === -1) throw new Error(`Column "${CONSTANTS.HEADER_PDF}" missing.`);

    const updates = [];
    let matchCount = 0;

    // Loop rows (skip header)
    for (let i = 1; i < data.length; i++) {
      const rowTitle = StringUtils.clean(data[i][titleIdx]);
      let finalUrl = "";

      // Logic: Sheet Title -> CSV Filename -> Drive URL
      if (rowTitle && titleToFilenameMap.has(rowTitle)) {
        const targetFilename = titleToFilenameMap.get(rowTitle);
        
        // Try exact match or match with .pdf extension
        if (folderFileMap.has(targetFilename)) {
          finalUrl = folderFileMap.get(targetFilename);
        } else if (folderFileMap.has(targetFilename + ".pdf")) {
          finalUrl = folderFileMap.get(targetFilename + ".pdf");
        }
      }

      if (finalUrl) matchCount++;
      
      // Keep existing data if no new match found
      updates.push([finalUrl !== "" ? finalUrl : data[i][pdfIdx]]);
    }

    // Write Back
    if (updates.length > 0) {
      sheet.getRange(2, pdfIdx + 1, updates.length, 1).setValues(updates);
    }

    return { matches: matchCount };
  }
};