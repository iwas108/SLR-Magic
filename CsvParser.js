/**
 * CsvParser.js
 * Handles CSV parsing and mapping to domain objects.
 */

const CsvParser = (function() {

  /**
   * Parses CSV string into an array of objects.
   * Uses the first row as headers.
   * @param {string} csvContent
   * @returns {Array<Object>} Array of objects where keys are CSV headers.
   */
  function parseCsvToObjects(csvContent) {
    if (!csvContent) return [];

    // Use Utilities.parseCsv for robust parsing handling quotes, etc.
    const data = Utilities.parseCsv(csvContent);
    if (data.length < 2) return []; // Only header or empty

    // Clean headers: remove quotes, trim, replace spaces with underscores, capitalize first char
    const headers = data[0].map(h => {
      let clean = h.replace(/['"]/g, '').trim();
      clean = clean.replace(/\s+/g, '_');
      if (clean.length > 0) {
        clean = clean.charAt(0).toUpperCase() + clean.slice(1);
      }
      return clean;
    });
    const result = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const obj = {};
      // Map row values to headers
      for (let j = 0; j < headers.length; j++) {
        // Safe access in case row length < headers length
        obj[headers[j]] = (j < row.length) ? row[j] : "";
      }
      result.push(obj);
    }
    return result;
  }

  return {
    parseCsvToObjects
  };

})();
