/**
 * VisualizerController.js
 * Handles the logic for the Visualizer module (Sankey Diagram).
 */

var VisualizerController = (function() {

  /**
   * Opens the Sankey Diagram settings/visualizer dialog.
   */
  function openSankeySettings() {
    const html = HtmlService.createHtmlOutputFromFile('VisualizerSankeyUI')
      .setWidth(1200) // Wide enough for diagram
      .setHeight(800)
      .setTitle('Sankey Diagram Visualizer');
    SpreadsheetApp.getUi().showModalDialog(html, 'Sankey Diagram Visualizer');
  }

  /**
   * Retrieves headers from 04_data_collection.
   */
  function getDataCollectionColumns() {
    try {
      // Check if sheet exists
      const ss = SheetUtils.getSpreadsheet();
      const sheet = ss.getSheetByName("04_data_collection");

      if (!sheet) {
        return [];
      }

      const lastCol = sheet.getLastColumn();
      if (lastCol === 0) return [];

      const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
        .filter(h => h && h.toString().trim() !== "");

      return headers;
    } catch (e) {
      console.warn("Error fetching columns from 04_data_collection", e);
      return [];
    }
  }

  /**
   * Processes data for the Sankey Diagram.
   * @param {Object} config - { columns: [{ name: "ColA", separator: "," }, ...] }
   */
  function processSankeyData(config) {
    try {
      const sheet = SheetUtils.getSheetByName("04_data_collection");
      const data = SheetUtils.getDataAsObjects(sheet);

      // Filter out rows that might be empty or invalid if necessary,
      // but getDataAsObjects handles basic empty row skipping.

      return prepareSankeyData(data, config.columns);
    } catch (e) {
      console.error(e);
      throw new Error("Error processing Sankey data: " + e.message);
    }
  }

  /**
   * Pure function to transform rows into nodes and links.
   * @param {Array<Object>} rows
   * @param {Array<Object>} columnsConfig Ordered list of { name, separator }
   */
  function prepareSankeyData(rows, columnsConfig) {
    const nodesMap = new Map(); // key: "ColName:::Value" -> Node Object
    const linksMap = new Map(); // key: "SourceKey->TargetKey" -> count

    if (!rows || rows.length === 0 || !columnsConfig || columnsConfig.length < 2) {
      return { nodes: [], links: [] };
    }

    // Helper to generate unique key
    const makeKey = (colName, val) => `${colName}:::${val}`;

    // Helper to split and normalize values
    const getValues = (rowVal, separator) => {
      if (rowVal === null || rowVal === undefined) return ["(Empty)"];
      const str = String(rowVal).trim();
      if (str === "") return ["(Empty)"];

      if (separator && separator.trim() !== "") {
        // Split by separator, trim parts, remove empty parts
        return str.split(separator)
          .map(s => s.trim())
          .filter(s => s !== "");
      }
      return [str];
    };

    rows.forEach(row => {
      // Iterate through adjacent pairs of columns
      for (let i = 0; i < columnsConfig.length - 1; i++) {
        const sourceCol = columnsConfig[i];
        const targetCol = columnsConfig[i + 1];

        const sourceRaw = row[sourceCol.name];
        const targetRaw = row[targetCol.name];

        const sourceVals = getValues(sourceRaw, sourceCol.separator);
        const targetVals = getValues(targetRaw, targetCol.separator);

        // Add nodes and links
        sourceVals.forEach(sVal => {
          const sKey = makeKey(sourceCol.name, sVal);
          if (!nodesMap.has(sKey)) {
            nodesMap.set(sKey, { name: sKey });
          }

          targetVals.forEach(tVal => {
            const tKey = makeKey(targetCol.name, tVal);
            if (!nodesMap.has(tKey)) {
              nodesMap.set(tKey, { name: tKey });
            }

            const linkKey = `${sKey}->${tKey}`;
            const currentCount = linksMap.get(linkKey) || 0;
            linksMap.set(linkKey, currentCount + 1);
          });
        });
      }
    });

    const nodes = Array.from(nodesMap.values());
    const links = Array.from(linksMap.entries()).map(([key, value]) => {
      const [source, target] = key.split("->");
      return { source, target, value };
    });

    return { nodes, links };
  }

  return {
    openSankeySettings,
    getDataCollectionColumns,
    processSankeyData
  };

})();
