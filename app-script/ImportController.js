/**
 * ImportController.js
 * Orchestrates the import process and deduplication.
 */

const ImportController = (function() {

  /**
   * Normalizes a string for duplicate checking.
   * Lowercase, remove non-alphanumeric.
   */
  function normalize(str) {
    if (!str) return "";
    return String(str).toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  /**
   * Loads existing DOIs and Titles from 00_Raw_Harvest.
   */
  function loadExistingKeys(sheet) {
    const existingData = SheetUtils.getDataAsObjects(sheet);
    const existingDois = new Set();
    const existingTitles = new Set();

    existingData.forEach(row => {
      const doi = row["DOI"] ? String(row["DOI"]).trim() : "";
      const title = row["Title"] ? String(row["Title"]).trim() : "";
      if (doi) {
        existingDois.add(normalize(doi));
      }
      if (title) {
        existingTitles.add(normalize(title));
      }
    });

    return { existingDois, existingTitles };
  }

  /**
   * Ingests CSV data from the Ingestion Hub.
   * @param {string} csvString
   * @param {string} sourceName
   * @param {string} importDate
   * @param {Object} columnMapping
   * @param {Array} secondaryColumns
   * @returns {string} Success or error message.
   */
  function ingestCSVData(csvString, sourceName, importDate, columnMapping, secondaryColumns) {
    try {
      if (typeof columnMapping === 'string') {
        columnMapping = JSON.parse(columnMapping);
      }
      if (typeof secondaryColumns === 'string') {
        secondaryColumns = JSON.parse(secondaryColumns);
      }
      
      if (!csvString) throw new Error("CSV data is empty.");
      
      const parsedData = Utilities.parseCsv(csvString);
      if (parsedData.length < 2) throw new Error("CSV has no records.");

      const csvHeaders = parsedData[0].map(h => h.trim());
      const rows = parsedData.slice(1);

      const sheet = SheetUtils.getSheetByName("00_Raw_Harvest");
      if (!sheet) {
        throw new Error("Target ingestion sheet (00_Raw_Harvest) not found. Please run environment initialization.");
      }

      // 1. Load existing keys for duplicate check
      const { existingDois, existingTitles } = loadExistingKeys(sheet);

      // Backwards compatibility fallback if mapping is not provided
      if (!columnMapping) {
        columnMapping = {};
        const basic = ['DOI', 'Title', 'Abstract', 'Authors', 'Year', 'PDF_Link'];
        basic.forEach(h => {
          if (csvHeaders.includes(h)) {
            columnMapping[h] = h;
          }
        });
      }
      if (!secondaryColumns) {
        secondaryColumns = csvHeaders.filter(h => !Object.values(columnMapping).includes(h));
      }

      const basicHeaders = ['Paper_ID', 'Import_Date', 'Import_Source', 'Source', 'DOI', 'Title', 'Abstract', 'Authors', 'Year', 'PDF_Link'];

      // Ensure basic headers and secondary columns are present
      const headerMap = SheetUtils.getHeaderMap(sheet);
      basicHeaders.forEach(h => SheetUtils.ensureColumn(sheet, h, headerMap));
      secondaryColumns.forEach(sc => SheetUtils.ensureColumn(sheet, sc, headerMap));

      const updatedHeaderMap = SheetUtils.getHeaderMap(sheet);
      const recordsToAppend = [];
      let duplicateCount = 0;

      // 3. Map rows and filter duplicates
      rows.forEach(rowArr => {
        const csvRowObj = {};
        csvHeaders.forEach((h, idx) => {
          csvRowObj[h] = rowArr[idx];
        });

        // Map mandatory fields using the columnMapping
        const doiVal = columnMapping["DOI"] ? (csvRowObj[columnMapping["DOI"]] || "") : "";
        const titleVal = columnMapping["Title"] ? (csvRowObj[columnMapping["Title"]] || "") : "";
        const abstractVal = columnMapping["Abstract"] ? (csvRowObj[columnMapping["Abstract"]] || "") : "";
        const authorsVal = columnMapping["Authors"] ? (csvRowObj[columnMapping["Authors"]] || "") : "";
        const yearVal = columnMapping["Year"] ? (csvRowObj[columnMapping["Year"]] || "") : "";
        const pdfLinkVal = columnMapping["PDF_Link"] ? (csvRowObj[columnMapping["PDF_Link"]] || "") : "";

        const normalizedDoi = doiVal ? normalize(doiVal) : "";
        const normalizedTitle = titleVal ? normalize(titleVal) : "";

        // Duplicate Check
        if (normalizedDoi) {
          if (existingDois.has(normalizedDoi)) {
            duplicateCount++;
            return;
          }
        } else if (normalizedTitle) {
          if (existingTitles.has(normalizedTitle)) {
            duplicateCount++;
            return;
          }
        }

        // Prepare new record
        const record = {
          "Paper_ID": "",
          "Import_Source": sourceName || "CSV Ingest",
          "Source": sourceName || "CSV Ingest",
          "Import_Date": importDate || new Date().toISOString().split('T')[0],
          "DOI": doiVal,
          "Title": titleVal,
          "Abstract": abstractVal,
          "Authors": authorsVal,
          "Year": yearVal,
          "PDF_Link": pdfLinkVal
        };

        // Copy selected secondary columns
        secondaryColumns.forEach(sc => {
          record[sc] = csvRowObj[sc] !== undefined ? csvRowObj[sc] : "";
        });

        // Generate Paper ID
        record["Paper_ID"] = PaperDomain.generatePaperId(record);

        recordsToAppend.push(record);
      });

      // 4. Write records
      if (recordsToAppend.length > 0) {
        SheetUtils.appendDataMapped(sheet, recordsToAppend, updatedHeaderMap);
      }

      // Reorder columns
      const desiredOrder = ["Paper_ID", "Import_Date", "Import_Source", "Source", "DOI", "Title", "Abstract", "Authors", "Year", "PDF_Link"];
      SheetUtils.reorderColumns(sheet, desiredOrder);

      return `CSV Import Complete!\nTotal Processed: ${rows.length}\nDuplicates Skipped: ${duplicateCount}\nSuccessfully Imported: ${recordsToAppend.length}`;
    } catch (e) {
      console.error(e);
      throw new Error("CSV Ingestion Error: " + e.message);
    }
  }

  /**
   * Ingests a single manually entered paper from the Ingestion Hub.
   * @param {Object} paperData
   * @returns {string} Success or error message.
   */
  function ingestManualPaperData(paperData) {
    try {
      const sheet = SheetUtils.getSheetByName("00_Raw_Harvest");
      if (!sheet) {
        throw new Error("Target ingestion sheet (00_Raw_Harvest) not found. Please run environment initialization.");
      }

      // 1. Load existing keys for duplicate check
      const { existingDois, existingTitles } = loadExistingKeys(sheet);

      const doiVal = paperData.doi ? String(paperData.doi).trim() : "";
      const titleVal = paperData.title ? String(paperData.title).trim() : "";

      const normalizedDoi = doiVal ? normalize(doiVal) : "";
      const normalizedTitle = titleVal ? normalize(titleVal) : "";

      // Duplicate Check
      if (normalizedDoi) {
        if (existingDois.has(normalizedDoi)) {
          throw new Error("Duplicate entry: A paper with this DOI already exists in 00_Raw_Harvest.");
        }
      } else if (normalizedTitle) {
        if (existingTitles.has(normalizedTitle)) {
          throw new Error("Duplicate entry: A paper with this Title already exists in 00_Raw_Harvest.");
        }
      }

      // 2. Ensure basic headers
      const headerMap = SheetUtils.getHeaderMap(sheet);
      const basicHeaders = ['Paper_ID', 'Import_Date', 'Import_Source', 'Source', 'DOI', 'Title', 'Abstract', 'Authors', 'Year', 'PDF_Link'];
      basicHeaders.forEach(h => SheetUtils.ensureColumn(sheet, h, headerMap));

      const updatedHeaderMap = SheetUtils.getHeaderMap(sheet);

      // 3. Build record
      const record = {
        "Title": titleVal,
        "Authors": paperData.authors || "",
        "Year": paperData.year || "",
        "DOI": doiVal,
        "Abstract": paperData.abstract || "",
        "Source": paperData.source || "Manual Entry",
        "Import_Source": paperData.source || "Manual Entry",
        "Import_Date": paperData.importDate || new Date().toISOString().split('T')[0],
        "PDF_Link": ""
      };

      record["Paper_ID"] = PaperDomain.generatePaperId(record);

      // 4. Write
      SheetUtils.appendDataMapped(sheet, [record], updatedHeaderMap);
      
      // Reorder columns
      const desiredOrder = ["Paper_ID", "Import_Date", "Import_Source", "Source", "DOI", "Title", "Abstract", "Authors", "Year", "PDF_Link"];
      SheetUtils.reorderColumns(sheet, desiredOrder);

      return `Successfully ingested manual paper: "${record.Title}".`;
    } catch (e) {
      console.error(e);
      throw new Error("Manual Ingestion Error: " + e.message);
    }
  }

  return {
    ingestCSVData: ingestCSVData,
    ingestManualPaperData: ingestManualPaperData
  };

})();
