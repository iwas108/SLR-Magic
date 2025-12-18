/**
 * PaperDomain.js
 * Domain logic for Paper entities.
 */

const PaperDomain = (function() {

  /**
   * Generates a meaningful Paper ID.
   * Format: AuthorLastName_Year_TitleStart(First 15 chars)
   * Sanitizes to be alphanumeric.
   * @param {Object} rawData
   * @returns {string}
   */
  function generatePaperId(rawData) {
    // Scopus 'Authors' usually looks like "Smith J., Doe A." or "Smith, J."
    // We want the first author's last name.
    let author = "Unknown";
    const authorsField = rawData['Authors'] || "";

    if (authorsField) {
      // Split by comma
      const parts = authorsField.split(',');
      if (parts.length > 0) {
        // First part usually contains Last Name if format is "Last, F.M."
        // Or if "Last F.M.", split by space.
        // Let's try to grab the first word that looks like a name.
        const firstPart = parts[0].trim();
        // If it contains a space, take the first token (often Last Name in Scopus)
        const nameParts = firstPart.split(' ');
        author = nameParts[0].replace(/[^a-zA-Z0-9]/g, "");
      }
    }

    let year = rawData['Year'] || "NoYear";

    let title = rawData['Title'] || "";
    // Take first 10 alphanumeric chars of title
    let shortTitle = title.replace(/[^a-zA-Z0-9]/g, "").substring(0, 15);

    // Add a random suffix to ensure uniqueness in case of collisions (same author, year, similar title start)
    // Or we rely on the caller to deduplicate. For now, let's keep it simple but somewhat unique.
    // Ideally we might want a sequence number, but we don't know the existing papers easily without querying them all.
    // Let's add a random 4-char string.
    const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

    return `${author}_${year}_${shortTitle}_${randomSuffix}`;
  }

  return {
    generatePaperId
  };

})();
