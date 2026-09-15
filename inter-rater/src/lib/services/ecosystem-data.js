


export const ECOSYSTEM_MODULES = [
  {
    id: 'slr-ide',
    name: 'SLR-IDE Desktop Hub',
    shortName: 'SLR-IDE',
    role: 'Central Desktop Control Hub & AI Orchestrator',
    tagline: 'The all-in-one local cockpit orchestrating the entire systematic review lifecycle.',
    description:
      'Hosts the local SQLite database, PDF cache matcher and crawlers, automated LaTeX citation syncer, 4-stage Google Gemini screening pipeline, calibration pooling, and post-pipeline token umbrellanizer.',
    techStack: ['Next.js 15', 'React 19', 'SQLite 3', 'Tailwind CSS v4', 'Python 3', 'Google Gemini API'],
    defaultPort: 3000,
    badgeText: 'Central Hub',
    badgeVariant: 'primary',
    gradient: 'from-blue-600/20 via-indigo-600/10 to-transparent',
    iconName: 'Laptop',
    capabilities: [
      {
        title: 'Multi-Source Reference Ingestion',
        desc: 'Ingests RIS, BibTeX, and CSV exports from Scopus, IEEE Xplore, Web of Science, ACM, and PubMed with automatic deduplication.'
      },
      {
        title: 'Automated Reference Syncer',
        desc: 'Scans LaTeX (.tex) manuscripts, resolves citations against db/references.bib, flags plain-text or broken keys, and exports synchronized files.'
      },
      {
        title: 'Full-Text PDF Engine & Scrapers',
        desc: 'Matches cached PDFs by Title/DOI and triggers headless crawlers to retrieve missing open-access research papers.'
      },
      {
        title: '4-Stage Gemini AI Screening Pipeline',
        desc: 'Orchestrates Fast Filter (Stage 1), Gatekeeper (Stage 2), Scientist QA (Stage 3), and Miner Schema Extraction (Stage 4) with token audit logs.'
      },
      {
        title: 'Calibration Pooling & Agreement Metrics',
        desc: 'Generates double-blind CAL_Pool packages, computes Cohen/Fleiss Kappa scores, and provides human adjudication workspaces.'
      },
      {
        title: 'Post-Pipeline Token Umbrellanizer',
        desc: 'Clusters multi-label raw manuscript tags into standardized umbrella categories with model justifications and exportable mappings.'
      }
    ],
    inputs: ['BibTeX (.bib)', 'CSV Harvest (.csv)', 'LaTeX Manuscripts (.tex)', 'Blinded Review Sessions (.slr)'],
    outputs: ['Blinded Review Packages (.slr)', 'Snapshot Visualizer Bundles (.slr-viewer)', 'FAIR Compliant CSV (.csv)'],
    isLocalOnly: true,
    isBlindedSafe: false,
    documentationAnchor: 'slr-ide/architecture.md'
  },
  {
    id: 'inter-rater',
    name: 'Inter-Rater Blinded Client',
    shortName: 'Inter-Rater',
    role: 'Blinded Human Agreement & Calibration Client',
    tagline: 'An offline-first, distraction-free SPA for independent human review calibration.',
    description:
      'Facilitates blinded peer reviews without revealing AI decisions or co-reviewer selections. Reviewers score papers using rapid keyboard shortcuts and export compressed review packages.',
    techStack: ['React 19', 'Vite', 'LocalStorage / Dexie', 'Tailwind CSS v4', 'Browser WebStreams GZIP'],
    defaultPort: 3001,
    badgeText: 'Double-Blind Client',
    badgeVariant: 'emerald',
    gradient: 'from-emerald-600/20 via-teal-600/10 to-transparent',
    iconName: 'ShieldCheck',
    capabilities: [
      {
        title: 'Strict Double-Blind Review Sandboxing',
        desc: 'Completely strips AI ratings, previous model rationales, and co-reviewer names to guarantee unbiased evaluation.'
      },
      {
        title: 'Rapid Keyboard Ergonomics',
        desc: 'Score papers instantly using keyboard shortcuts: [I] for Include, [E] for Exclude, [1]-[9] for exclusion criteria rules, and arrows for navigation.'
      },
      {
        title: 'Integrated PDF Reader & Abstract Splitter',
        desc: 'Seamless side-by-side or split layout displaying full paper text or metadata while entering appraisal criteria.'
      },
      {
        title: 'Dynamic QA Scoring & Parameter Extraction',
        desc: 'Custom structured inputs for scoring scientific quality assessment questions and recording empirical data points.'
      },
      {
        title: 'Transparent GZIP Compression',
        desc: 'Auto-detects and exports compact GZIP-compressed .slr review bundles for seamless re-ingestion into SLR-IDE.'
      }
    ],
    inputs: ['Blinded Review Package (.slr, uncompressed or GZIP)'],
    outputs: ['Completed Review Package (.slr)'],
    isLocalOnly: true,
    isBlindedSafe: true,
    documentationAnchor: 'inter-rater/architecture.md'
  },
  {
    id: 'slr-viewer',
    name: 'SLR-Viewer Snapshot Visualizer',
    shortName: 'SLR-Viewer',
    role: 'Read-Only Publication Presentation & Evaluation Client',
    tagline: 'Client-side visualizer rendering PRISMA 2020 flowcharts, 19 scientific charts, and spend telemetry.',
    description:
      'Operates 100% offline in client browsers using Dexie.js (IndexedDB) to inspect exported dataset snapshots without requiring an active database connection or backend server.',
    techStack: ['React 19', 'Vite', 'Dexie.js (IndexedDB)', 'Apache ECharts 6', 'Tailwind CSS v4', 'Self-Hosted WOFF2'],
    defaultPort: 3002,
    badgeText: 'Presentation SPA',
    badgeVariant: 'purple',
    gradient: 'from-purple-600/20 via-pink-600/10 to-transparent',
    iconName: 'BarChart3',
    capabilities: [
      {
        title: 'Interactive 2D PRISMA 2020 Flowchart',
        desc: 'Renders complete PRISMA 2020 flow diagrams with live stage counts, sub-criteria breakdowns, SVG vector export, and high-DPI PNG generation.'
      },
      {
        title: 'Visualizer Studio (19 Scientific Chart Types)',
        desc: 'Generate publication-grade Sankey flows, Treemaps, Sunbursts, Radar diagrams, Clustered Bars, and Heatmaps with 76 Academic Color Palettes.'
      },
      {
        title: 'Screened Corpus & Screening History Ledger',
        desc: 'Transparently audits all 1,800+ candidate papers across every screening stage with exclusion triggers and Gemini LLM reasoning history.'
      },
      {
        title: 'LLM Accounting & Cost Telemetry',
        desc: 'Comprehensive breakdown of API token consumption, stage-by-stage USD expenditure, and top expensive API calls.'
      },
      {
        title: 'PRISMA Items 6 & 7 Scientific Rigor Specifications',
        desc: 'Generates publication-ready methodology text describing search strategies, Boolean syntax, and AI screening protocol.'
      }
    ],
    inputs: ['Dataset Snapshot Package (.slr-viewer)'],
    outputs: ['Vector SVG Charts', 'High-DPI PNG Graphics', 'JSON Rigor Specifications', 'Cohort CSV'],
    isLocalOnly: false,
    isBlindedSafe: false,
    documentationAnchor: 'slr-viewer/architecture.md'
  },
  {
    id: 'worker-server',
    name: 'Distributed Remote Worker Node',
    shortName: 'Scraper Node',
    role: 'Distributed Headless Crawling & PDF Retrieval Node',
    tagline: 'Lightweight background server to offload intensive crawling tasks across local network nodes.',
    description:
      'Runs headless Selenium/ChromeDriver workers on LAN nodes to scrape open-access PDFs and bypass IP rate limits without consuming local workstation CPU/RAM.',
    techStack: ['Python 3', 'FastAPI / Uvicorn', 'Undetected-ChromeDriver', 'Selenium'],
    defaultPort: 7291,
    badgeText: 'Worker Node',
    badgeVariant: 'sky',
    gradient: 'from-sky-600/20 via-cyan-600/10 to-transparent',
    iconName: 'Cpu',
    capabilities: [
      {
        title: 'LAN Distributed PDF Acquisition',
        desc: 'Distributes parallel PDF downloading queues across secondary laptops or home-lab servers on the same local Wi-Fi or LAN.'
      },
      {
        title: 'Anti-Detection Browser Automation',
        desc: 'Executes stealth browser sessions to locate unpaywalled full-text publications across institutional repositories.'
      },
      {
        title: 'Strict Project Scoping & Isolation',
        desc: 'Returns acquired PDFs to SLR-IDE with strict Project_ID scoping to eliminate cross-project state corruption.'
      }
    ],
    inputs: ['PDF Download Work Orders (JSON)'],
    outputs: ['Acquired PDF Files (.pdf)', 'HTTP Retrieval Status Telemetry'],
    isLocalOnly: true,
    isBlindedSafe: false
  }
];

export const ECOSYSTEM_WORKFLOW_STEPS = [
  {
    step: 1,
    name: 'Literature Ingestion & Citation Sync',
    fromModuleId: 'external',
    toModuleId: 'slr-ide',
    exchangeType: 'Import',
    fileFormat: 'CSV / BibTeX / .tex',
    description:
      'Export bibliographic references from Scopus, IEEE Xplore, or Web of Science into SLR-IDE. Scan LaTeX manuscripts with Reference Syncer to ensure citation keys match db/references.bib.',
    privacyGuarantee: 'All raw bibliometrics stored locally in slr.db SQLite database.'
  },
  {
    step: 2,
    name: 'Blinded Calibration Pool Export',
    fromModuleId: 'slr-ide',
    toModuleId: 'inter-rater',
    exchangeType: 'File Handoff',
    fileFormat: '.slr (JSON / GZIP)',
    description:
      'SLR-IDE packages a stratified sample of papers (CAL_Pool_A/B/C) into an uncompressed or GZIP-compressed .slr file with all AI ratings and reviewer names stripped.',
    privacyGuarantee: 'Zero LLM decision leakage; guarantees unbiased independent human evaluation.'
  },
  {
    step: 3,
    name: 'Blinded Review & Agreement Re-Ingestion',
    fromModuleId: 'inter-rater',
    toModuleId: 'slr-ide',
    exchangeType: 'Return Import',
    fileFormat: '.slr (Completed)',
    description:
      'Reviewers score papers in Inter-Rater via keyboard shortcuts. Completed review packages are exported back to SLR-IDE to compute Cohen/Fleiss Kappa scores and resolve discrepancies.',
    privacyGuarantee: 'Reviewer decisions remain isolated until intentional adjudication sync.'
  },
  {
    step: 4,
    name: '4-Stage AI Screening & Snapshot Export',
    fromModuleId: 'slr-ide',
    toModuleId: 'slr-viewer',
    exchangeType: 'Offline Snapshot',
    fileFormat: '.slr-viewer (JSON Bundle)',
    description:
      'SLR-IDE runs the 4-stage Gemini pipeline (Fast Filter, Gatekeeper, Scientist, Miner) and Token Umbrellanizer, then exports a complete, self-contained project snapshot bundle.',
    privacyGuarantee: '100% offline snapshot; can be shared with auditors or hosted on static GitHub Pages.'
  },
  {
    step: 5,
    name: 'Open Science & FAIR Compliance Publishing',
    fromModuleId: 'slr-ide',
    toModuleId: 'external',
    exchangeType: 'FAIR Export',
    fileFormat: '.csv (Standard RFC 4180)',
    description:
      'Final included papers, synthesized taxonomy classifications, quality assessment scores, and PRISMA counts are exported as standardized RFC 4180 CSV with UTF-8 BOM for FAIR open-science publishing in Zenodo, OSF, or institutional archives.',
    privacyGuarantee: 'Sanitized public datasets with zero credential or file path leakage.'
  }
];

export const ECOSYSTEM_FILE_SPECS = [
  {
    extension: '.slr',
    fullName: 'SLR Magic Blinded Review Session File',
    primaryProducer: 'SLR-IDE (Export) / Inter-Rater (Export)',
    primaryConsumer: 'Inter-Rater (Import) / SLR-IDE (Re-ingestion)',
    purpose: 'Facilitates double-blind inter-rater agreement calibration without network connections.',
    formatDescription: 'JSON or GZIP-compressed JSON containing paper abstracts, metadata, and evaluation criteria.',
    privacyNote: 'Excludes all AI classifications and co-reviewer choices to prevent cognitive anchoring.'
  },
  {
    extension: '.slr-viewer',
    fullName: 'SLR Magic Dataset Snapshot Bundle',
    primaryProducer: 'SLR-IDE (Insight & Export)',
    primaryConsumer: 'SLR-Viewer SPA (Dexie.js / IndexedDB)',
    purpose: 'Complete self-contained bundle for offline presentation, PRISMA flowcharts, and 19 scientific charts.',
    formatDescription: 'Standardized JSON structure (Schema v1.3.0) containing project metadata, final cohort, screened corpus ledger, and LLM telemetry.',
    privacyNote: 'API keys, database credentials, and local system paths are strictly excluded.'
  },
  {
    extension: '.csv',
    fullName: 'FAIR Tabular Dataset Archive',
    primaryProducer: 'SLR-IDE (FAIR Data Export)',
    primaryConsumer: 'Zenodo / OSF / Python / R / SPSS / Spreadsheet Archives',
    purpose: 'Interoperable spreadsheet data export for open science publishing and statistical analysis.',
    formatDescription: 'UTF-8 BOM (\\uFEFF) RFC 4180-compliant CSV with escaped quotes and multi-label array serialization.',
    privacyNote: 'Contains finalized academic evidence quotes and extracted variables.'
  },
  {
    extension: '.bib / .tex',
    fullName: 'Authoritative BibTeX & LaTeX Manuscripts',
    primaryProducer: 'Zotero / Mendeley / JabRef / LaTeX Authors',
    primaryConsumer: 'SLR-IDE Reference Syncer',
    purpose: 'Authoritative source of truth for scholarly citations, scanned against draft manuscripts.',
    formatDescription: 'Standard BibTeX database (db/references.bib) and LaTeX source files (.tex).',
    privacyNote: 'Non-destructive parsing preserves LaTeX formatting, prenotes, and comments.'
  }
];

/**
 * Utility to resolve the dynamic network URL for any ecosystem sub-module.
 * Automatically mirrors the active host (localhost or LAN IPv4) while switching to the module's dedicated port.
 * When accessed from GitHub Pages (or cloud static hosting), routes to the respective static SPA paths.
 */
export function resolveModuleUrl(defaultPort, moduleId, fallbackPath) {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname || 'localhost';
    const isGitHubPages = hostname.includes('github.io') || hostname.includes('pages.dev');

    if (isGitHubPages) {
      const origin = window.location.origin;
      if (moduleId === 'inter-rater') return `${origin}/SLR-Magic/inter-rater/dist/`;
      if (moduleId === 'slr-viewer') return `${origin}/SLR-Magic/slr-viewer/dist/`;
      if (moduleId === 'slr-ide') return 'http://localhost:3000';
      if (moduleId === 'worker-server') return 'http://localhost:7291';
      return `${origin}/SLR-Magic/`;
    }

    const protocol = window.location.protocol || 'http:';
    if (defaultPort) {
      return `${protocol}//${hostname}:${defaultPort}`;
    }
  }

  if (defaultPort) {
    return `http://localhost:${defaultPort}`;
  }
  return fallbackPath || '#';
}

