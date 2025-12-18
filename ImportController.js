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

      const mappedRecords = rawRecords.map(record => {
        // Scopus Columns: Authors, Title, Year, Source title, Link, Abstract, etc.
        // Target Columns: Paper_ID, Title, Abstract, Year, Authors, DOI_Link, Source_DB

        // Handle DOI_Link
        // Use Link if available, else DOI.
        let link = record['Link'] || "";
        if (!link && record['DOI']) {
          link = "https://doi.org/" + record['DOI'];
        }

        return {
          'Paper_ID': PaperDomain.generatePaperId(record),
          'Title': record['Title'],
          'Abstract': record['Abstract'],
          'Year': record['Year'],
          'Authors': record['Authors'],
          'DOI_Link': link,
          'Source_DB': 'Scopus', // Hardcoded as per context
          'AI_Status': 'Pending'
        };
      });

      // 6. Write to Sheet
      const targetSheetName = "01_abstract_screening";
      const targetSheet = SheetUtils.getSheetByName(targetSheetName);
      const headerMap = SheetUtils.getHeaderMap(targetSheet);

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
