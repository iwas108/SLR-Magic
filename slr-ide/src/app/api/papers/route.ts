import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import db, { getConfig } from '@/lib/db';
import crypto from 'crypto';
import { clearSemanticSearchCache } from '@/lib/services/semantic-search-cache';

function generatePaperId(rawData: { Title?: string; DOI?: string; Authors?: string; Year?: any }): string {
  const authorsField = rawData.Authors || "";
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

  const year = rawData.Year || "NoYear";
  const title = rawData.Title || "";
  const shortTitle = title.replace(/[^a-zA-Z0-9]/g, "").substring(0, 15);

  const doi = rawData.DOI || "";
  const stringToHash = (title + doi + authorsField).toLowerCase().replace(/[^a-z0-9]/g, "");
  const finalStringToHash = stringToHash || (author + year + shortTitle);

  const hashStr = crypto.createHash('md5').update(finalStringToHash).digest('hex').substring(0, 5);

  return `${author}_${year}_${shortTitle}_${hashStr}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');
    
    // Check if only hashes/deduplication keys are requested
    if (searchParams.get('onlyHashes') === 'true') {
      const rows = db.prepare("SELECT DOI, Title FROM papers WHERE Project_ID = ?").all(activeProjectId) as { DOI: string; Title: string }[];
      return NextResponse.json(rows);
    }

    // Check if only unique publishers are requested
    if (searchParams.get('getPublishers') === 'true') {
      const rows = db.prepare("SELECT DISTINCT Publisher FROM papers WHERE Project_ID = ? AND Publisher IS NOT NULL AND Publisher != '' ORDER BY Publisher ASC").all(activeProjectId) as { Publisher: string }[];
      return NextResponse.json(rows.map(r => r.Publisher));
    }

    const search = searchParams.get('search')?.trim() || '';
    const status = searchParams.get('status')?.trim() || '';
    const pdfStatus = searchParams.get('pdfStatus')?.trim() || '';
    const calibrationPool = searchParams.get('calibrationPool')?.trim() || '';
    const calibrationTag = searchParams.get('calibrationTag')?.trim() || '';
    const publisher = searchParams.get('publisher')?.trim() || '';
    const source = searchParams.get('source')?.trim() || '';
    
    // Sort parameters
    const sortBy = searchParams.get('sortBy')?.trim() || 'Paper_ID';
    const sortOrder = searchParams.get('sortOrder')?.trim() || 'ASC';
    
    // Pagination parameters
    const pageVal = parseInt(searchParams.get('page') || '1', 10);
    const page = !isNaN(pageVal) && pageVal > 0 ? pageVal : 1;
    
    const limitVal = parseInt(searchParams.get('limit') || '50', 10);
    const limit = !isNaN(limitVal) && limitVal > 0 ? limitVal : 50;

    let filterQuery = ' FROM papers WHERE Project_ID = ? AND (is_duplicate IS NULL OR is_duplicate = 0)';
    const params: any[] = [activeProjectId];

    if (search) {
      filterQuery += ' AND (Paper_ID LIKE ? OR Title LIKE ? OR Abstract LIKE ? OR Authors LIKE ? OR DOI LIKE ? OR Publisher LIKE ?)';
      const searchWildcard = `%${search}%`;
      params.push(searchWildcard, searchWildcard, searchWildcard, searchWildcard, searchWildcard, searchWildcard);
    }

    if (status) {
      filterQuery += ' AND Status = ?';
      params.push(status);
    }

    if (pdfStatus) {
      filterQuery += ' AND Local_PDF_Status = ?';
      params.push(pdfStatus);
    }

    if (publisher) {
      filterQuery += ' AND Publisher = ?';
      params.push(publisher);
    }

    if (source) {
      if (source === 'manual') {
        filterQuery += " AND (Import_Source = 'Manual Search' OR Import_Source = 'Manual Ingestion')";
      } else if (source === 'backward') {
        filterQuery += " AND Import_Source = 'Backward Snowball'";
      } else if (source === 'forward') {
        filterQuery += " AND Import_Source = 'Forward Snowball'";
      } else if (source === 'csv') {
        filterQuery += " AND Import_Source NOT IN ('Manual Search', 'Manual Ingestion', 'Backward Snowball', 'Forward Snowball')";
      }
    }

    if (calibrationPool) {
      if (calibrationPool === 'none') {
        filterQuery += ' AND (calibration_pool IS NULL OR calibration_pool = \'\')';
      } else {
        filterQuery += ' AND calibration_pool = ?';
        params.push(calibrationPool);
      }
    }

    if (calibrationTag) {
      if (calibrationTag === 'none') {
        filterQuery += ' AND (calibration_tag IS NULL OR calibration_tag = \'\')';
      } else {
        filterQuery += ' AND calibration_tag = ?';
        params.push(calibrationTag);
      }
    }

    const decision = searchParams.get('decision')?.trim() || '';
    if (decision) {
      if (decision === 'INCLUDE') {
        filterQuery += ` AND (
          Human_Decision = 'INCLUDE' OR 
          (Human_Decision IS NULL AND (
            SELECT decision FROM reviewer_decisions 
            WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID 
            ORDER BY imported_at DESC LIMIT 1
          ) = 'INCLUDE')
        )`;
      } else if (decision === 'EXCLUDE') {
        filterQuery += ` AND (
          Human_Decision = 'EXCLUDE' OR 
          (Human_Decision IS NULL AND (
            SELECT decision FROM reviewer_decisions 
            WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID 
            ORDER BY imported_at DESC LIMIT 1
          ) = 'EXCLUDE')
        )`;
      } else if (decision === 'UNADJUDICATED') {
        filterQuery += ` AND Human_Decision IS NULL AND (
          SELECT decision FROM reviewer_decisions 
          WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID 
          ORDER BY imported_at DESC LIMIT 1
        ) IS NULL`;
      }
    }

    // Check if only IDs matching the current query filters are requested
    if (searchParams.get('onlyIds') === 'true') {
      const rows = db.prepare(`SELECT Paper_ID ${filterQuery}`).all(...params) as { Paper_ID: string }[];
      return NextResponse.json(rows.map(r => r.Paper_ID));
    }

    // 1. Get total matching count
    const countRow = db.prepare(`SELECT COUNT(*) as count ${filterQuery}`).get(...params) as { count: number } | undefined;
    const total = countRow ? countRow.count : 0;

    // 2. Sorting whitelist validation to prevent SQL Injection
    const allowedSortColumns = ['Paper_ID', 'Title', 'Authors', 'Year', 'DOI', 'Local_PDF_Status', 'Status', 'calibration_pool', 'calibration_tag', 'Human_Decision', 'Human_EC_Trigger', 'Human_Rationale', 'Publisher', 'citation_count'];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'Paper_ID';
    const safeSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // 3. Paginated and sorted query execution with AI decisions subqueries
    const offset = (page - 1) * limit;
    const dataQuery = `
      SELECT *, 
             (SELECT Title FROM papers parent WHERE parent.Paper_ID = papers.Parent_Paper_ID) as Parent_Paper_Title,
             (SELECT COUNT(*) FROM reviewer_decisions WHERE paper_id = papers.Paper_ID AND project_id = papers.Project_ID) > 0 as reviewer_decisions_exist
      ${filterQuery} 
      ORDER BY ${safeSortBy} ${safeSortOrder} 
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...params, limit, offset];

    const papers = db.prepare(dataQuery).all(...dataParams);
    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      papers,
      total,
      page,
      limit,
      totalPages
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch papers' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { papers, syncCitations } = body;

    if (!Array.isArray(papers)) {
      return NextResponse.json({ error: 'Payload must contain a "papers" array' }, { status: 400 });
    }

    let importedCount = 0;
    let skippedCount = 0;
    let updatedCitationsCount = 0;

    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');

    const findByDoiStmt = db.prepare("SELECT Paper_ID, DOI FROM papers WHERE DOI = ? AND DOI IS NOT NULL AND DOI != '' AND Project_ID = ?");
    const findByTitleStmt = db.prepare("SELECT Paper_ID, DOI FROM papers WHERE LOWER(REPLACE(Title, ' ', '')) = ? AND Project_ID = ?");
    const updateCitationStmt = db.prepare("UPDATE papers SET citation_count = ? WHERE Paper_ID = ?");
    const updateCitationAndDoiStmt = db.prepare("UPDATE papers SET citation_count = ?, DOI = ? WHERE Paper_ID = ?");

    const insertStmt = db.prepare(`
      INSERT INTO papers (
        Paper_ID, Import_Date, Import_Source, Source, DOI, Title, Abstract, Authors, Year, PDF_Link, Status, Local_PDF_Status, Project_ID, Parent_Paper_ID, Original_Publisher, Publisher, citation_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Fetch all existing paper IDs globally to resolve conflicts on Paper_ID (which is the primary key)
    const allPaperIds = (db.prepare('SELECT Paper_ID FROM papers').all() as { Paper_ID: string }[]).map(r => r.Paper_ID);
    const paperIdSet = new Set(allPaperIds);
    
    let idCounter = 0;
    for (const id of allPaperIds) {
      if (id) {
        const match = id.match(/\d+/);
        if (match) {
          const val = parseInt(match[0], 10);
          if (!isNaN(val) && val > idCounter) {
            idCounter = val;
          }
        }
      }
    }

    const transaction = db.transaction(() => {
      for (const paper of papers) {
        const title = paper.Title?.trim();
        if (!title) {
          skippedCount++;
          continue; // Title is mandatory
        }

        const doi = paper.DOI?.trim() || '';
        
        // Double-key Deduplication:
        // 1. Normalized DOI check (if DOI exists)
        let duplicate = false;
        let existingPaperId = '';
        let existingPaperDoi = '';
        if (doi) {
          const existingDoi = findByDoiStmt.get(doi, activeProjectId) as { Paper_ID: string; DOI: string } | undefined;
          if (existingDoi) {
            duplicate = true;
            existingPaperId = existingDoi.Paper_ID;
            existingPaperDoi = existingDoi.DOI;
          }
        }

        // 2. Stripped Title check (lowercase, remove spaces)
        if (!duplicate) {
          const cleanTitle = title.toLowerCase().replace(/\s+/g, '');
          const existingTitle = findByTitleStmt.get(cleanTitle, activeProjectId) as { Paper_ID: string; DOI: string } | undefined;
          if (existingTitle) {
            duplicate = true;
            existingPaperId = existingTitle.Paper_ID;
            existingPaperDoi = existingTitle.DOI;
          }
        }

        if (duplicate) {
          if (syncCitations && existingPaperId) {
            let citationCount = 0;
            if (paper.citation_count !== undefined && paper.citation_count !== null && paper.citation_count !== '') {
              const parsedCitations = parseInt(paper.citation_count, 10);
              if (!isNaN(parsedCitations)) {
                citationCount = parsedCitations;
              }
            }
            
            // Check if the current DOI in DB is empty, but incoming CSV has a filled DOI
            const isDbDoiEmpty = !existingPaperDoi || existingPaperDoi.trim() === '';
            const isIncomingDoiFilled = !!doi && doi.trim() !== '';
            
            if (isDbDoiEmpty && isIncomingDoiFilled) {
              updateCitationAndDoiStmt.run(citationCount, doi.trim(), existingPaperId);
            } else {
              updateCitationStmt.run(citationCount, existingPaperId);
            }
            updatedCitationsCount++;
          }
          skippedCount++;
          continue;
        }

        // Generate Paper_ID deterministically
        let paperId = generatePaperId({
          Title: title,
          DOI: doi,
          Authors: paper.Authors,
          Year: paper.Year
        });

        // Resolve conflict if the Paper_ID already exists globally in the database
        if (paperIdSet.has(paperId)) {
          let suffix = 1;
          let candidateId = `${paperId}_${suffix}`;
          while (paperIdSet.has(candidateId)) {
            suffix++;
            candidateId = `${paperId}_${suffix}`;
          }
          paperId = candidateId;
        }
        paperIdSet.add(paperId);

        // Map values
        const importDate = paper.Import_Date || new Date().toISOString().split('T')[0];
        const importSource = paper.Import_Source || 'CSV Import';
        const source = paper.Source || '';
        const abstract = paper.Abstract || '';
        const authors = paper.Authors || '';
        
        // Safe integer parsing for year to prevent NaN bindings in SQLite
        let year: number | null = null;
        if (paper.Year) {
          const parsedYear = parseInt(paper.Year, 10);
          if (!isNaN(parsedYear)) {
            year = parsedYear;
          }
        }

        // Safe integer parsing for citation_count
        let citationCount: number | null = null;
        if (paper.citation_count !== undefined && paper.citation_count !== null && paper.citation_count !== '') {
          const parsedCitations = parseInt(paper.citation_count, 10);
          if (!isNaN(parsedCitations)) {
            citationCount = parsedCitations;
          }
        }

        const pdfLink = paper.PDF_Link || '';
        const status = paper.Status || 'PENDING';
        
        // Initial Local PDF status
        const localPdfStatus = 'IGNORED';
        const parentPaperId = paper.Parent_Paper_ID || null;
        const originalPublisher = paper.Original_Publisher || paper.Publisher || '';
        const publisherVal = '';

        insertStmt.run(
          paperId,
          importDate,
          importSource,
          source,
          doi,
          title,
          abstract,
          authors,
          year,
          pdfLink,
          status,
          localPdfStatus,
          activeProjectId,
          parentPaperId,
          originalPublisher,
          publisherVal,
          citationCount
        );
        importedCount++;
      }
    });

    transaction();

    // Invalidate semantic search cache for the active project
    clearSemanticSearchCache(activeProjectId);

    return NextResponse.json({
      success: true,
      total: papers.length,
      imported: importedCount,
      skipped: skippedCount,
      updatedCitations: updatedCitationsCount
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to import papers' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { paperIds, status, localPdfStatus, humanDecision } = body;

    if (!Array.isArray(paperIds) || paperIds.length === 0) {
      return NextResponse.json({ error: 'Payload must contain a non-empty "paperIds" array' }, { status: 400 });
    }

    if (status === undefined && localPdfStatus === undefined && humanDecision === undefined) {
      return NextResponse.json({ error: 'Payload must specify at least one attribute to update ("status", "localPdfStatus" or "humanDecision")' }, { status: 400 });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (status !== undefined) {
      updates.push('Status = ?');
      params.push(status);
    }

    if (localPdfStatus !== undefined) {
      updates.push('Local_PDF_Status = ?');
      params.push(localPdfStatus);
    }

    if (humanDecision !== undefined) {
      if (humanDecision === 'CLEAR') {
        updates.push('Human_Decision = NULL, Human_EC_Trigger = NULL, Human_Rationale = NULL');
      } else {
        updates.push('Human_Decision = ?');
        params.push(humanDecision);
      }
    }

    const setClause = updates.join(', ');
    const query = `UPDATE papers SET ${setClause} WHERE Paper_ID = ?`;

    const stmt = db.prepare(query);
    const transaction = db.transaction((ids: string[]) => {
      for (const id of ids) {
        stmt.run(...params, id);
      }
    });

    transaction(paperIds);

    // Invalidate semantic search cache for the active project
    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');
    clearSemanticSearchCache(activeProjectId);

    return NextResponse.json({ success: true, updatedCount: paperIds.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update papers' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const confirm = searchParams.get('confirm');

    if (confirm !== 'DELETE_ALL') {
      return NextResponse.json({ error: 'Confirmation parameter confirm=DELETE_ALL is required' }, { status: 400 });
    }

    const activeProjectId = getConfig('ACTIVE_PROJECT_ID', 'default-project');
    
    // PDF Rescue
    const { rescuePdfAssets } = require('@/lib/pdf-utils');
    const papers = db.prepare('SELECT Paper_ID FROM papers WHERE Project_ID = ?').all(activeProjectId) as { Paper_ID: string }[];
    const paperIds = papers.map(p => p.Paper_ID);
    const rescuedCount = rescuePdfAssets(paperIds);

    db.prepare('DELETE FROM papers WHERE Project_ID = ?').run(activeProjectId);

    // Invalidate semantic search cache for the active project
    clearSemanticSearchCache(activeProjectId);

    return NextResponse.json({ 
      success: true, 
      message: `All papers deleted successfully. Rescued ${rescuedCount} PDF assets.` 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete all papers' }, { status: 500 });
  }
}
