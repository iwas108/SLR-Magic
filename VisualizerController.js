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
   * Opens the Pie Chart settings/visualizer dialog.
   */
  function openPieChartSettings() {
    const html = HtmlService.createHtmlOutputFromFile('VisualizerPieChartUI')
      .setWidth(1000)
      .setHeight(800)
      .setTitle('Pie Chart Visualizer');
    SpreadsheetApp.getUi().showModalDialog(html, 'Pie Chart Visualizer');
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
   * Processes data for the Pie Chart.
   * @param {Object} config - { column: { name: "ColA", separator: "," } }
   */
  function processPieChartData(config) {
    try {
      const sheet = SheetUtils.getSheetByName("04_data_collection");
      const data = SheetUtils.getDataAsObjects(sheet);

      return preparePieChartData(data, config.column);
    } catch (e) {
      console.error(e);
      throw new Error("Error processing Pie Chart data: " + e.message);
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

  /**
   * Pure function to prepare pie chart data.
   */
  function preparePieChartData(rows, columnConfig) {
    if (!rows || rows.length === 0 || !columnConfig) {
      return { legendData: [], seriesData: [] };
    }

    const counts = new Map();
    const separator = columnConfig.separator;

    rows.forEach(row => {
      let rawVal = row[columnConfig.name];
      if (rawVal === null || rawVal === undefined) rawVal = "(Empty)";
      let str = String(rawVal).trim();
      if (str === "") str = "(Empty)";

      let values = [str];
      if (separator && separator.trim() !== "") {
        values = str.split(separator).map(s => s.trim()).filter(s => s !== "");
        if (values.length === 0) values = ["(Empty)"];
      }

      values.forEach(val => {
        counts.set(val, (counts.get(val) || 0) + 1);
      });
    });

    const legendData = [];
    const seriesData = [];

    // Convert map to array and sort by value desc
    const sortedEntries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);

    sortedEntries.forEach(([name, value]) => {
      legendData.push(name);
      seriesData.push({ name, value });
    });

    return { legendData, seriesData };
  }

  /**
   * Opens the Bar Chart settings/visualizer dialog.
   */
  function openBarChartSettings() {
    const html = HtmlService.createHtmlOutputFromFile('VisualizerBarChartUI')
      .setWidth(1000)
      .setHeight(800)
      .setTitle('Bar Chart Visualizer');
    SpreadsheetApp.getUi().showModalDialog(html, 'Bar Chart Visualizer');
  }

  /**
   * Processes data for the Bar Chart.
   * @param {Object} config - { xAxisColumn: "ColName", seriesColumns: ["ColA", "ColB"] }
   */
  function processBarChartData(config) {
    try {
      const sheet = SheetUtils.getSheetByName("04_data_collection");
      const data = SheetUtils.getDataAsObjects(sheet);

      return prepareBarChartData(data, config);
    } catch (e) {
      console.error(e);
      throw new Error("Error processing Bar Chart data: " + e.message);
    }
  }

  /**
   * Pure function to prepare bar chart data.
   */
  function prepareBarChartData(rows, config) {
    if (!rows || rows.length === 0 || !config || !config.xAxisColumn || !config.seriesColumns) {
      return { xAxisData: [], series: [] };
    }

    const xAxisColumn = config.xAxisColumn;
    const seriesColumns = config.seriesColumns;

    const xAxisData = [];
    const seriesMap = new Map(); // ColName -> Array of numbers

    // Initialize series arrays
    seriesColumns.forEach(col => seriesMap.set(col, []));

    rows.forEach(row => {
      // 1. Process X-Axis Label
      let label = row[xAxisColumn];
      if (label === null || label === undefined) label = "(Empty)";
      else label = String(label).trim();
      if (label === "") label = "(Empty)";

      xAxisData.push(label);

      // 2. Process Series Data
      seriesColumns.forEach(col => {
        let val = row[col];
        // Parse number
        let num = parseFloat(val);
        if (isNaN(num)) {
          // Try to handle strings like "$100" or "1,000" if needed, but standard parseFloat is basic
          // If strictly non-numeric, use 0 or null?
          // ECharts handles null as "no bar", 0 as "zero height".
          // Let's use 0 for simplicity in this context, or null if empty string.
          if (val === "" || val === null || val === undefined) {
             num = null;
          } else {
             // If it's text, it might be 0
             num = 0;
          }
        }
        seriesMap.get(col).push(num);
      });
    });

    // Format for ECharts
    const series = [];
    seriesColumns.forEach(col => {
      series.push({
        name: col,
        data: seriesMap.get(col)
      });
    });

    return { xAxisData, series };
  }

  return {
    openSankeySettings,
    openPieChartSettings,
    openBarChartSettings,
    getDataCollectionColumns,
    processSankeyData,
    processPieChartData,
    processBarChartData
  };

})();
