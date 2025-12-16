/**
 * DataProcessor
 * Logic for mapping data structures (CSV to Maps).
 */
const DataProcessor = {
  mapCsvData: function(csvData) {
    const map = new Map();
    // Assuming Col 0 = Title, Col 1 = Filename
    for (let i = 1; i < csvData.length; i++) {
      if (csvData[i].length >= 2) {
        const title = StringUtils.clean(csvData[i][0]);
        const filename = StringUtils.clean(csvData[i][1]);
        map.set(title, filename);
      }
    }
    return map;
  }
};

/**
 * StringUtils
 * Generic string helpers.
 */
const StringUtils = {
  clean: function(str) {
    return str ? String(str).trim().toLowerCase() : "";
  }
};