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

    // 1. Find the authors field (handle variations)
    const authorKeys = ['Authors', 'Author full names', 'Author(s)'];
    let authorsField = "";
    for (const key of authorKeys) {
      if (rawData[key]) {
        authorsField = rawData[key];
        break;
      }
    }

    let author = "Unknown";

    if (authorsField) {
      // 2. Scopus separates multiple authors with semicolons
      // e.g., "Zhu, T.; Zhang, W." -> "Zhu, T."
      const firstAuthor = authorsField.split(';')[0].trim();

      if (firstAuthor) {
        // 3. Extract Last Name
        // Format is typically "Last, First" or "Last First"
        if (firstAuthor.includes(',')) {
          // "Zhu, T." -> "Zhu"
          author = firstAuthor.split(',')[0].trim();
        } else {
          // "Zhu T." or "Zhu"
          // Take the first token
          author = firstAuthor.split(' ')[0].trim();
        }

        // Sanitize
        author = author.replace(/[^a-zA-Z0-9]/g, "");
      }
    }

    // Fallback if extraction failed but field existed
    if (!author) author = "Unknown";

    let year = rawData['Year'] || "NoYear";

    let title = rawData['Title'] || "";
    // Take first 15 alphanumeric chars of title
    let shortTitle = title.replace(/[^a-zA-Z0-9]/g, "").substring(0, 15);

    // Add a random suffix to ensure uniqueness in case of collisions (same author, year, similar title start)
    const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

    return `${author}_${year}_${shortTitle}_${randomSuffix}`;
  }

  return {
    generatePaperId
  };

})();
