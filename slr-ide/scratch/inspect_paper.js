const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'db', 'slr.db');
const db = new Database(dbPath);

const activeProjectId = 'default-project';
const pool = 'pool_c';

// Find reviewers
const reviewerRows = db.prepare(`
  SELECT DISTINCT reviewer_name 
  FROM reviewer_decisions 
  WHERE project_id = ? AND pool = ?
  ORDER BY reviewer_name ASC
`).all(activeProjectId, pool);
console.log('Reviewers found:', reviewerRows);

if (reviewerRows.length >= 2) {
  const r1 = reviewerRows[0].reviewer_name;
  const r2 = reviewerRows[1].reviewer_name;

  const pairedDecisions = db.prepare(`
    SELECT rd.paper_id,
           p.Title as title,
           p.Abstract as abstract,
           p.Local_PDF_Path as local_pdf_path,
           p.Authors as authors,
           p.Year as year,
           p.DOI as doi,
           p.Source as source,
           p.PDF_Link as pdf_link,
           p.Publisher as publisher
    FROM reviewer_decisions rd
    JOIN papers p ON rd.paper_id = p.Paper_ID AND rd.project_id = p.Project_ID
    WHERE rd.project_id = ? AND rd.pool = 'pool_c'
    GROUP BY rd.paper_id
    HAVING COUNT(DISTINCT rd.reviewer_name) = 2
  `).all(activeProjectId);

  const matched = pairedDecisions.find(d => d.paper_id === 'Alam_2025_DigitalTwinDriv_63689');
  console.log('Matched Paired Decision:', matched);
} else {
  console.log('Not enough reviewers in the database.');
}
