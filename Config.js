/**
 * ConfigModule
 * Handles reading and validating the Manifest configuration.
 */
const ConfigModule = {
  
  load: function(ss) {
    const sheet = ss.getSheetByName(CONSTANTS.SHEET_MANIFEST);
    if (!sheet) throw new Error(`Sheet "${CONSTANTS.SHEET_MANIFEST}" is missing.`);

    const rawConfig = this._parseSheetToObj(sheet);
    
    // Validate required keys
    const dbUrl = rawConfig[CONSTANTS.KEY_PDF_DB];
    const repoUrl = rawConfig[CONSTANTS.KEY_PDF_REPO];

    if (!dbUrl) throw new Error(`Key "${CONSTANTS.KEY_PDF_DB}" is missing in Manifest.`);
    if (!repoUrl) throw new Error(`Key "${CONSTANTS.KEY_PDF_REPO}" is missing in Manifest.`);

    return {
      dbUrl: dbUrl.toString().trim(),
      repoUrl: repoUrl.toString().trim()
    };
  },

  _parseSheetToObj: function(sheet) {
    const data = sheet.getDataRange().getValues();
    const config = {};
    for (let row of data) {
      if (row[0]) config[row[0]] = row[1];
    }
    return config;
  }
};