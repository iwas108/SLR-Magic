/**
 * ImportController.js
 * Orchestrates the import process.
 */

const ImportController = (function() {

  function run() {
    const ui = SpreadsheetApp.getUi();

    try {
      // 1. Notify User
      ui.alert("Starting Import process. This might take a few seconds.");
      // Optional: Use toast for less intrusive updates
      SpreadsheetApp.getActiveSpreadsheet().toast("Reading configuration...", "SLR Magic");

      // 2. Read Config
      const config = SheetUtils.getConfigMap("00_manifest");
      const csvUrl = config['RAW_CSV_DATABASE'];

      if (!csvUrl) {
        throw new Error("Key 'RAW_CSV_DATABASE' not found or empty in 00_manifest.");
      }

      // 3. Fetch CSV
      SpreadsheetApp.getActiveSpreadsheet().toast("Fetching CSV from Drive...", "SLR Magic");
      const csvContent = DriveUtils.getFileContent(csvUrl);

      // 4. Parse CSV
      SpreadsheetApp.getActiveSpreadsheet().toast("Parsing CSV...", "SLR Magic");
      const rawRecords = CsvParser.parseCsvToObjects(csvContent);

      if (rawRecords.length === 0) {
        throw new Error("CSV file appears to be empty.");
      }

      // 5. Map to Target Structure
      SpreadsheetApp.getActiveSpreadsheet().toast(`Processing ${rawRecords.length} records...`, "SLR Magic");

      // 5a. Identify all unique keys from CSV to ensure columns exist
      const allKeys = new Set();
      rawRecords.forEach(r => Object.keys(r).forEach(k => allKeys.add(k)));

      // Add internal keys that we generate
      allKeys.add('Paper_ID');
      allKeys.add('AI_Status');
      allKeys.add('DOI_Link');
      allKeys.add('Source_DB');

      // 5b. Ensure columns exist in the target sheet
      const targetSheetName = "01_abstract_screening";
      const targetSheet = SheetUtils.getSheetByName(targetSheetName);
      const headerMap = SheetUtils.getHeaderMap(targetSheet);

      allKeys.forEach(key => {
          SheetUtils.ensureColumn(targetSheet, key, headerMap);
      });

      // 5c. Map Records
      const mappedRecords = rawRecords.map(record => {
        // Start with all CSV data
        const mapped = { ...record };

        // Overwrite/Set Internal Fields
        mapped['Paper_ID'] = PaperDomain.generatePaperId(record);
        mapped['AI_Status'] = 'Pending';
        mapped['Source_DB'] = 'Scopus';

        // Handle DOI_Link
        // Use Link if available, else DOI.
        let link = record['Link'] || "";
        if (!link && record['DOI']) {
          link = "https://doi.org/" + record['DOI'];
        }
        mapped['DOI_Link'] = link;

        return mapped;
      });

      // 6. Write to Sheet
      SheetUtils.appendDataMapped(targetSheet, mappedRecords, headerMap);

      // 7. Success Message
      SpreadsheetApp.getActiveSpreadsheet().toast("Import complete!", "SLR Magic");
      ui.alert(`Successfully imported ${mappedRecords.length} papers into ${targetSheetName}.`);

    } catch (e) {
      console.error(e);
      ui.alert("Error during import: " + e.message);
    }
  }

  return {
    run
  };

})();
