/**
 * PaperDomain.js
 * Domain logic for Paper entities.
 */

const PaperDomain = (function() {

    /**
   * Generates a stable MD5 hash string.
   */
  function md5(string) {
    // A simple, pure JS MD5 implementation or we can use Apps Script Utilities.
    // Apps Script Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, string)
    // returns a byte array which we need to convert to hex.
    const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, string);
    let hexString = '';
    for (let i = 0; i < digest.length; i++) {
      let byte = digest[i];
      if (byte < 0) {
        byte += 256;
      }
      let hex = byte.toString(16);
      if (hex.length === 1) {
        hex = '0' + hex;
      }
      hexString += hex;
    }
    return hexString;
  }

  /**
   * Generates a meaningful, deterministic Paper ID.
   * Format: AuthorLastName_Year_TitleStart(First 15 chars)_Hash(4 chars)
   * The hash ensures uniqueness deterministically based on Title + DOI + Authors.
   * @param {Object} rawData
   * @returns {string}
   */
  function generatePaperId(rawData) {
    // 1. Find the authors field
    const authorKeys = ['Authors', 'Author_full_names', 'Author(s)'];
    let authorsField = "";
    for (const key of authorKeys) {
      if (rawData[key]) {
        authorsField = rawData[key];
        break;
      }
    }

    let author = "Unknown";
    if (authorsField) {
      const firstAuthor = authorsField.split(';')[0].trim();
      if (firstAuthor) {
        if (firstAuthor.includes(',')) {
          author = firstAuthor.split(',')[0].trim();
        } else {
          author = firstAuthor.split(' ')[0].trim();
        }
        author = author.replace(/[^a-zA-Z0-9]/g, "");
      }
    }
    if (!author) author = "Unknown";

    let year = rawData['Year'] || "NoYear";

    let title = rawData['Title'] || "";
    let shortTitle = title.replace(/[^a-zA-Z0-9]/g, "").substring(0, 15);

    // 2. Generate a deterministic hash instead of a random number
    const doi = rawData['DOI'] || "";
    const stringToHash = (title + doi + authorsField).toLowerCase().replace(/[^a-z0-9]/g, "");

    // Fallback if somehow empty
    const finalStringToHash = stringToHash || (author + year + shortTitle);

    // Get MD5 hash and take first 5 characters
    const hashStr = md5(finalStringToHash).substring(0, 5);

    return `${author}_${year}_${shortTitle}_${hashStr}`;
  }

  return {
    generatePaperId
  };

})();
