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
   * Helper to parse numeric values from strings more robustly.
   */
  function parseNumber(val) {
    if (val === null || val === undefined || val === "") return null;
    if (typeof val === 'number') return val;

    // Remove non-numeric characters except dot and minus (for currency, commas, etc)
    // E.g. "$1,200.50" -> "1200.50"
    // E.g. "1,000" -> "1000"
    // Note: This is a simple parser, might not handle European format (1.000,00) correctly if mixed.
    // Assuming US/Standard format.
    const str = String(val).replace(/,/g, '').replace(/[^\d.-]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
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
    const aggregationType = config.aggregationType || 'None';

    const xAxisData = [];
    const seriesMap = new Map(); // ColName -> Array of numbers

    // Initialize series arrays in map for final output
    seriesColumns.forEach(col => seriesMap.set(col, []));

    if (aggregationType === 'None') {
      // Original Logic: Row by Row
      rows.forEach(row => {
        // 1. Process X-Axis Label
        let label = row[xAxisColumn];
        if (label === null || label === undefined) label = "(Empty)";
        else label = String(label).trim();
        if (label === "") label = "(Empty)";

        xAxisData.push(label);

        // 2. Process Series Data
        seriesColumns.forEach(col => {
          // Use robust parser
          let num = parseNumber(row[col]);
          if (num === null && row[col] && String(row[col]).trim() !== "") {
              // If text exists but not number, treat as 0 for plotting
              num = 0;
          }
          seriesMap.get(col).push(num);
        });
      });

    } else {
      // Aggregation Logic: Group by X-Axis

      // 1. Group Data
      const groups = new Map(); // X-Value -> { count: 0, seriesVals: { ColName: [] } }

      rows.forEach(row => {
        let label = row[xAxisColumn];
        if (label === null || label === undefined) label = "(Empty)";
        else label = String(label).trim();
        if (label === "") label = "(Empty)";

        if (!groups.has(label)) {
            groups.set(label, { count: 0, seriesVals: {} });
            seriesColumns.forEach(col => groups.get(label).seriesVals[col] = []);
        }

        const group = groups.get(label);
        group.count++;

        seriesColumns.forEach(col => {
           group.seriesVals[col].push(row[col]);
        });
      });

      // 2. Compute Aggregates
      // Sort keys optionally? For now, insertion order (or alphabetical?)
      // Typically charts look better if sorted or consistent. Map iterates in insertion order.
      // Let's sort keys alphabetically for consistency if they are strings
      const sortedKeys = Array.from(groups.keys()).sort();

      sortedKeys.forEach(key => {
         xAxisData.push(key);
         const group = groups.get(key);

         seriesColumns.forEach(col => {
            const rawVals = group.seriesVals[col];
            let resultVal = 0;

            if (aggregationType === 'Count') {
                // Count non-empty values in this series column
                // If the user just wants row count, any column works.
                // But specifically for this column:
                resultVal = rawVals.filter(v => v !== null && v !== undefined && String(v).trim() !== "").length;
            } else {
                // Parse numbers for Sum, Avg, Min, Max
                const nums = rawVals.map(v => parseNumber(v)).filter(n => n !== null);

                if (nums.length === 0) {
                    resultVal = null; // No data
                } else {
                    if (aggregationType === 'Sum') {
                        resultVal = nums.reduce((a, b) => a + b, 0);
                    } else if (aggregationType === 'Average') {
                        const sum = nums.reduce((a, b) => a + b, 0);
                        resultVal = sum / nums.length;
                    } else if (aggregationType === 'Min') {
                        resultVal = Math.min(...nums);
                    } else if (aggregationType === 'Max') {
                        resultVal = Math.max(...nums);
                    }
                }
            }
            seriesMap.get(col).push(resultVal);
         });
      });
    }

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

  /**
   * Opens the Stack Bar Chart settings/visualizer dialog.
   */
  function openBarStackSettings() {
    const html = HtmlService.createHtmlOutputFromFile('VisualizerStackBarUI')
      .setWidth(1000)
      .setHeight(800)
      .setTitle('Stack Bar Chart Visualizer');
    SpreadsheetApp.getUi().showModalDialog(html, 'Stack Bar Chart Visualizer');
  }

  /**
   * Processes data for the Stack Bar Chart.
   * @param {Object} config - { xAxisColumn, stackColumn, separator, stackMode, topN }
   */
  function processBarStackData(config) {
    try {
      const sheet = SheetUtils.getSheetByName("04_data_collection");
      const data = SheetUtils.getDataAsObjects(sheet);

      return prepareStackBarData(data, config);
    } catch (e) {
      console.error(e);
      throw new Error("Error processing Stack Bar Chart data: " + e.message);
    }
  }

  /**
   * Pure function to prepare stack bar chart data.
   */
  function prepareStackBarData(rows, config) {
    if (!rows || rows.length === 0 || !config || !config.xAxisColumn || !config.stackColumn) {
      return { xAxisData: [], series: [] };
    }

    const { xAxisColumn, stackColumn, separator, stackMode, topN } = config;

    // Map<XValue, Map<StackValue, Count>>
    const matrix = new Map();
    // Global counts for stack values to find Top N
    const stackGlobalCounts = new Map();

    // 1. Process Data
    rows.forEach(row => {
        // X-Axis
        let xVal = row[xAxisColumn];
        if (xVal === null || xVal === undefined) xVal = "(Empty)";
        else xVal = String(xVal).trim();
        if (xVal === "") xVal = "(Empty)";

        // Stack Value
        let rawStack = row[stackColumn];
        let stackVals = [];
        if (rawStack === null || rawStack === undefined) {
             stackVals = ["(Empty)"];
        } else {
             const str = String(rawStack).trim();
             if (str === "") {
                 stackVals = ["(Empty)"];
             } else if (separator && separator.trim() !== "") {
                 stackVals = str.split(separator).map(s => s.trim()).filter(s => s !== "");
                 if (stackVals.length === 0) stackVals = ["(Empty)"];
             } else {
                 stackVals = [str];
             }
        }

        if (!matrix.has(xVal)) {
            matrix.set(xVal, new Map());
        }
        const xMap = matrix.get(xVal);

        stackVals.forEach(val => {
            // Update Matrix
            xMap.set(val, (xMap.get(val) || 0) + 1);
            // Update Global
            stackGlobalCounts.set(val, (stackGlobalCounts.get(val) || 0) + 1);
        });
    });

    // 2. Identify Top N Stack Categories
    const sortedStackCats = Array.from(stackGlobalCounts.entries())
        .sort((a, b) => b[1] - a[1]);

    const topStackCats = new Set();
    const limit = topN || 10;
    sortedStackCats.slice(0, limit).forEach(entry => topStackCats.add(entry[0]));

    // 3. Re-aggregate with "Other"
    // Map<XValue, Map<StackCategory, Count>>
    const finalMatrix = new Map();
    const allXValues = Array.from(matrix.keys()).sort(); // Sort X-Axis

    allXValues.forEach(xVal => {
        finalMatrix.set(xVal, new Map());
        const sourceMap = matrix.get(xVal);
        const targetMap = finalMatrix.get(xVal);

        sourceMap.forEach((count, stackVal) => {
            const finalKey = topStackCats.has(stackVal) ? stackVal : "Other";
            targetMap.set(finalKey, (targetMap.get(finalKey) || 0) + count);
        });
    });

    // 4. Build Series
    const finalStackCats = Array.from(topStackCats);
    // Add "Other" if it exists in any X
    let hasOther = false;
    for (const xMap of finalMatrix.values()) {
        if (xMap.has("Other")) {
            hasOther = true;
            break;
        }
    }
    if (hasOther) finalStackCats.push("Other");

    const seriesData = [];
    finalStackCats.forEach(cat => {
        const dataPoints = [];
        allXValues.forEach(xVal => {
            const count = finalMatrix.get(xVal).get(cat) || 0;
            dataPoints.push(count);
        });
        seriesData.push({ name: cat, data: dataPoints });
    });

    // 5. Handle Percentage Mode
    if (stackMode === 'Percent') {
        // Calculate totals per X
        const totals = allXValues.map((_, i) => {
            let sum = 0;
            seriesData.forEach(series => {
                sum += series.data[i];
            });
            return sum;
        });

        // Normalize
        seriesData.forEach(series => {
            series.data = series.data.map((val, i) => {
                const total = totals[i];
                return total === 0 ? 0 : val / total;
            });
        });
    }

    return { xAxisData: allXValues, series: seriesData };
  }

  return {
    openSankeySettings,
    openPieChartSettings,
    openBarChartSettings,
    openBarStackSettings,
    getDataCollectionColumns,
    processSankeyData,
    processPieChartData,
    processBarChartData,
    processBarStackData
  };

})();
