/**
 * DataCollectionController.js
 * Handles extraction of JSON data from 'Raw' column into separate columns.
 */

var DataCollectionController = (function() {

  /**
   * Processes rows in '04_data_collection' with State = 0.
   * Extracts JSON from 'Raw' and populates columns.
   */
  function run() {
    try {
      const sheet = SheetUtils.getSheetByName("04_data_collection");
      const headerMap = SheetUtils.getHeaderMap(sheet);
      const data = SheetUtils.getDataAsObjects(sheet);

      // Filter rows with State = 0 (handle number or string)
      const rowsToProcess = data.filter(row => {
        const state = row["State"];
        return state == 0; // loose equality for 0 or "0"
      });

      if (rowsToProcess.length === 0) {
        SheetUtils.alert("No rows found with State = 0.");
        return;
      }

      SheetUtils.toast(`Scanning ${rowsToProcess.length} rows for keys...`, "Data Collection", -1);

      // 1. First Pass: Parse JSON and Collect Keys
      const allKeys = new Set();
      const validRows = []; // Stores { rowIndex, parsedData }
      let errorCount = 0;

      rowsToProcess.forEach(row => {
        const rowIndex = row._rowIndex;
        const rawJson = row["Raw"];

        if (!rawJson || rawJson.toString().trim() === "") {
            console.warn(`Row ${rowIndex}: 'Raw' column is empty.`);
            SheetUtils.updateRow(sheet, rowIndex, { "State": -1 }, headerMap);
            errorCount++;
            return;
        }

        try {
            const parsedData = JSON.parse(rawJson);
            validRows.push({ rowIndex: rowIndex, data: parsedData });

            // Collect keys
            Object.keys(parsedData).forEach(key => allKeys.add(key));
        } catch (e) {
            console.error(`Row ${rowIndex}: JSON Parse Error: ${e.message}`);
            SheetUtils.updateRow(sheet, rowIndex, { "State": -1 }, headerMap);
            try {
                if (headerMap["State"]) {
                    sheet.getRange(rowIndex, headerMap["State"]).setNote(`Error: ${e.message}`);
                }
            } catch(ign) {}
            errorCount++;
        }
      });

      // 2. Ensure Columns Exist
      if (allKeys.size > 0) {
        SheetUtils.toast(`Ensuring columns for ${allKeys.size} keys...`, "Data Collection", -1);
        allKeys.forEach(key => {
            SheetUtils.ensureColumn(sheet, key, headerMap);
        });
      }

      // 3. Second Pass: Write Data
      SheetUtils.toast(`Writing data to ${validRows.length} rows...`, "Data Collection", -1);
      let successCount = 0;

      validRows.forEach(item => {
          const rowIndex = item.rowIndex;
          const parsedData = item.data;

          try {
              for (const key of Object.keys(parsedData)) {
                  const dataObj = parsedData[key];
                  if (dataObj && typeof dataObj === 'object') {
                      const value = dataObj.value;
                      const evidence = dataObj.evidence;
                      const colIndex = headerMap[key]; // Should exist now

                      if (colIndex) {
                          const cell = sheet.getRange(rowIndex, colIndex);
                          if (value !== undefined) {
                              cell.setValue(value);
                          }
                          if (evidence !== undefined) {
                              cell.setNote(evidence);
                          }
                      }
                  }
              }
              // Success
              SheetUtils.updateRow(sheet, rowIndex, { "State": 1 }, headerMap);
              successCount++;
          } catch (e) {
              console.error(`Row ${rowIndex}: Write Error: ${e.message}`);
              SheetUtils.updateRow(sheet, rowIndex, { "State": -1 }, headerMap);
              errorCount++;
          }
      });

      SheetUtils.alert(`Data Collection Process Complete.\nSuccess: ${successCount}\nFailures: ${errorCount}`);

    } catch (e) {
      console.error(e);
      SheetUtils.alert(`Error in Data Collection: ${e.message}`);
    }
  }

  return {
    run
  };

})();
