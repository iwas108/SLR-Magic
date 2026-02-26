/**
 * ImportController.js
 * Orchestrates the import process.
 */

const ImportController = (function() {

  /**
   * Shows the Import Dialog.
   */
  function showImportDialog() {
    const html = HtmlService.createHtmlOutputFromFile('ImportCSVUI')
      .setWidth(700)
      .setHeight(600)
      .setTitle('Import Raw CSV');
    SpreadsheetApp.getUi().showModalDialog(html, 'Import Raw CSV');
  }

  /**
   * Fetches headers from a CSV URL.
   * @param {string} csvUrl
   * @returns {Object} { csvHeaders: [], systemHeaders: [] }
   */
  function getCSVHeaders(csvUrl) {
    try {
      const csvContent = DriveUtils.getFileContent(csvUrl);
      const data = Utilities.parseCsv(csvContent);
      if (data.length === 0) throw new Error("CSV file is empty.");

      // Raw CSV headers
      const csvHeaders = data[0].map(h => h.trim());

      // Existing System Headers from 01_abstract_screening
      const sheet = SheetUtils.getSheetByName("01_abstract_screening");
      const lastCol = sheet.getLastColumn();
      let systemHeaders = [];
      if (lastCol > 0) {
        systemHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].filter(h => h);
      }

      return {
        csvHeaders: csvHeaders,
        systemHeaders: systemHeaders
      };
    } catch (e) {
      console.error(e);
      throw new Error("Failed to fetch headers: " + e.message);
    }
  }

  /**
   * Normalizes a string for duplicate checking.
   * Lowercase, remove non-alphanumeric.
   */
  function normalize(str) {
    if (!str) return "";
    return String(str).toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  /**
   * Processes the import.
   * @param {string} url
   * @param {string} sourceName
   * @param {Object} mapping Map of CSV Header -> System Header
   */
  function processImport(url, sourceName, mapping) {
    try {
      // 1. Fetch & Parse CSV
      const csvContent = DriveUtils.getFileContent(url);
      const csvData = Utilities.parseCsv(csvContent);
      if (csvData.length < 2) throw new Error("CSV has no data.");

      const csvHeaders = csvData[0].map(h => h.trim());
      const rawRecords = csvData.slice(1);

      // 2. Load Existing Data for Duplicate Check
      const sheet = SheetUtils.getSheetByName("01_abstract_screening");
      const existingData = SheetUtils.getDataAsObjects(sheet);

      // Build Set for DOIs (normalized) and Titles (normalized)
      const existingDois = new Set();
      const existingTitles = new Set();

      existingData.forEach(row => {
        if (row["DOI"]) existingDois.add(normalize(row["DOI"]));
        // DOI_Link might contain DOI
        if (row["DOI_Link"] && row["DOI_Link"].includes("doi.org/")) {
             const parts = row["DOI_Link"].split("doi.org/");
             if (parts.length > 1) existingDois.add(normalize(parts[1]));
        }
        if (row["Title"]) existingTitles.add(normalize(row["Title"]));
      });

      // 3. Process Records
      const recordsToAppend = [];
      let duplicateCount = 0;

      // Ensure headers exist in target based on mapping
      const headerMap = SheetUtils.getHeaderMap(sheet);
      Object.values(mapping).forEach(destHeader => {
          if (destHeader && destHeader !== "_CREATE_NEW_") {
              SheetUtils.ensureColumn(sheet, destHeader, headerMap);
          }
      });
      SheetUtils.ensureColumn(sheet, "Source", headerMap);
      SheetUtils.ensureColumn(sheet, "Paper_ID", headerMap);
      SheetUtils.ensureColumn(sheet, "AI_Status", headerMap);
      SheetUtils.ensureColumn(sheet, "DOI_Link", headerMap); // Ensure this exists

      // We need to re-fetch headerMap if new columns were added?
      // ensureColumn updates headerMap in place, so we are good.

      rawRecords.forEach(rowArr => {
        // Construct object from CSV row
        const csvObj = {};
        csvHeaders.forEach((h, i) => {
            csvObj[h] = rowArr[i];
        });

        // 1. Check Duplicates
        // Find mapped DOI and Title columns
        // We look for which CSV header maps to "DOI" or "Title"
        let doiVal = "";
        let titleVal = "";

        // Iterate mapping to find source values for key fields
        for (const [csvKey, sysKey] of Object.entries(mapping)) {
            if (sysKey === "DOI") doiVal = csvObj[csvKey];
            if (sysKey === "Title") titleVal = csvObj[csvKey];
        }

        // Fallback: If not mapped explicitly, try to find in csvObj by name if mapping says "Title" -> "Title"
        // (Handled above by iterating mapping)

        if (doiVal && existingDois.has(normalize(doiVal))) {
            duplicateCount++;
            return;
        }
        if (!doiVal && titleVal && existingTitles.has(normalize(titleVal))) {
            // Only check Title if DOI is missing (Standard SLR practice: DOI is definitive)
            duplicateCount++;
            return;
        }

        // 2. Map to System Object
        const newRow = {};
        newRow["Source"] = sourceName;
        newRow["AI_Status"] = "Pending";

        for (const [csvKey, sysKey] of Object.entries(mapping)) {
            if (sysKey && sysKey !== "_CREATE_NEW_") {
                newRow[sysKey] = csvObj[csvKey];
            }
        }

        // 3. Generate Paper ID (if not present or we want to overwrite/ensure)
        // If mapped to Paper_ID, keep it. If not, generate.
        if (!newRow["Paper_ID"]) {
            // PaperDomain needs a raw object with keys like 'Authors', 'Year', 'Title' to work best.
            // We pass the newRow (mapped data) + csvObj (raw data) to give it best chance
            const combinedForId = { ...csvObj, ...newRow };
            newRow["Paper_ID"] = PaperDomain.generatePaperId(combinedForId);
        }

        // 4. Handle DOI Link
        if (!newRow["DOI_Link"] && newRow["DOI"]) {
             newRow["DOI_Link"] = "https://doi.org/" + newRow["DOI"];
        }

        recordsToAppend.push(newRow);
      });

      // 4. Write to Sheet
      if (recordsToAppend.length > 0) {
          SheetUtils.appendDataMapped(sheet, recordsToAppend, headerMap);
      }

      return {
        totalRows: rawRecords.length,
        duplicates: duplicateCount,
        imported: recordsToAppend.length,
        sourceName: sourceName
      };

    } catch (e) {
      console.error(e);
      throw new Error("Import failed: " + e.message);
    }
  }

  // To maintain backward compatibility if needed, though we are replacing the flow.
  // run() method is no longer used by the new UI but kept for safety if older menu items exist
  // until we update Main.js.
  function run() {
      showImportDialog();
  }

  return {
    run,
    showImportDialog,
    getCSVHeaders,
    processImport
  };

})();
