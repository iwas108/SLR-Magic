# SLR Viewer Improvements Log (`improvements-log.md`)

All notable changes, refactoring milestones, and feature additions to `slr-viewer/` are documented in this log.

## [#034] [2026-09-17] - Zero-Dependency Standalone Single-File Distribution & Dynamic Importer UX

### Standalone Distribution Architecture & Reusability
- **Selective Font Asset Optimization (`scripts/mirror-to-viewer.mjs` & `src/index.css`)**:
  - Pruned 68 unreferenced font variants from `slr-viewer/public/fonts/`, retaining only the 12 core `.woff2` font files.
  - Reduced font payload footprint from ~20.3 MB to ~1.05 MB (a 95% reduction).
  - Updated `index.css` `@font-face` declarations to strictly reference `.woff2` fonts, removing legacy `.ttf` fallbacks.
- **Hybrid Storage Engine with InMemory Fallback (`src/StorageService.ts`)**:
  - Implemented lazy `getDb()` initialization with Dexie exception guard to protect against `SecurityError` under `file:///` protocols in Firefox/Safari.
  - Implemented `InMemorySessionStore` providing complete session CRUD functionality in memory when browser IndexedDB is unavailable or blocked.
- **Dynamic Importer UX & Study Switcher (`src/components/import/SnapshotDropzone.tsx` & `src/components/common/Header.tsx`)**:
  - Added clean full-screen drag-and-drop landing onboarding dropzone when no review session is loaded, ensuring zero hardcoded study data is baked into standalone builds.
  - Integrated `[Switch Study]` button in the top header enabling reviewers to seamlessly switch between reviews or load new datasets.
  - Implemented `?autoload=initial-snapshot` URL parameter support in `ViewerContext.tsx` for automated snapshot loading when launched via native Go executable or CLI.
  - Added periodic `/api/heartbeat` ping (every 5s) for automatic launcher termination upon browser tab closure.
- **Single-File Bundling & Auto-Builder (`vite.config.ts` & `package.json`)**:
  - Integrated `vite-plugin-singlefile` under conditional `mode === 'singlefile'` bundling.
  - Injected dynamic version metadata tag `<meta name="slr-viewer-version">` into HTML `<head>`.
  - Added `build:singlefile` and `build:standalone` scripts producing self-contained ~3.88 MB single-file HTML distributions.
- **Verification**:
  - `npm --prefix slr-viewer run typecheck`: Passed with 0 errors.
  - `npm run build:standalone:viewer`: Successfully generated `dist-standalone/slr-viewer.html` and SHA256 checksum.

---

## [#033] [2026-09-15] - app-script Deprecation Cleanup & Dynamic SPA Route Resolution

### Architecture & Routing Upgrades
- **Dynamic Cloud SPA Route Resolution (`src/lib/services/ecosystem-data.ts`)**:
  - Removed deprecated `app-script` from module definitions and updated Step 5 of the review lifecycle to open science repository archiving (Zenodo, OSF, Dataverse).
  - Enhanced `resolveModuleUrl` to detect GitHub Pages (`*.github.io`) and static hosting (`*.pages.dev`), linking directly to static SPA production paths (`/SLR-Magic/<module>/dist/`) while retaining localhost/LAN port routing.
- **Verification**:
  - `npm run typecheck`: 0 errors.
  - `npm run build`: Production Vite build completed cleanly.

---

## [#032] [2026-09-15] - Ecosystem Hub & Cross-Module Architecture Navigation

### Feature Additions & Cross-Module Connectivity
- **Cross-Module Ecosystem Architecture Modal (`src/components/modals/EcosystemModal.tsx`)**:
  - Implemented standalone interactive modal displaying the complete SLR Magic architecture across all sub-modules (`slr-ide`, `inter-rater`, `slr-viewer`, `worker-server`).
  - Added 3 interactive tabs: `Sub-Modules & Capabilities` (with active node indicator, capabilities checklist, direct "Open App" links, and clipboard URL copying), `Inter-Module Lifecycle Workflow` (5-step data trajectory with route pills and privacy guarantees), and `Data Exchange File Formats` (.slr, .slr-viewer, .csv, .bib).
- **Shared Ecosystem Service & Network URL Resolver (`src/lib/services/ecosystem-data.ts`)**:
  - Master domain dictionary defining module specs, roles, tech stacks, and dynamic URL port resolution matching the current hostname.
- **Sidebar Integration (`src/components/Sidebar.tsx`)**:
  - Embedded "Ecosystem Hub" trigger button in the collapsible sidebar footer above the build timestamp and theme switchers.
- **Verification**:
  - `npm run typecheck`: 0 errors.
  - `npm run build`: Production Vite build completed cleanly.

---

## [#031] [2026-09-12] - Visualizer Studio: Foolproof Scientific Auto-Newline, Protocol-Aware Word Wrap & Atomic Token Protection

### Bug Fixes & Text Engine Refactoring
- **Atomic Token Classifier (`isAtomicSlashToken`)**:
  - Prevented premature or broken line wrapping of wireless/network protocols (e.g. `Wi-Fi WLAN (802.11 b/g/ax)` was splitting into `b/`, `g/`, `ax)`).
  - Protected domain patterns: `b/g/n`, `a/b/g/n/ac/ax`, `802.11b/g/n`, `TCP/IP`, `IPv4/IPv6`, `2G/3G/4G/5G`, `km/h`, `bits/s`, `samples/s`, `V/m`, `mW/cm2`, `w/`, `w/o`, `and/or`, `N/A`, `I/O`, `A/D`, `1/2`, `24/7`, and any slash compound where sub-tokens $\le 3$ characters.
- **Multi-Tier Semantic Word Wrapping Engine (`wrapAxisLabelText`)**:
  - Replaced naive unconditional `text.split('/')` with intelligent greedy word wrap.
  - Preserved explicit `\n` breaks.
  - Isolated trailing parenthetical qualifiers (e.g. `(802.11 b/g/ax)`, `(SVM)`, `(Mbps)`) so secondary specifications wrap as independent coherent blocks.
  - Implemented lazy compound word splitting for terms like `Agriculture/Horticulture` and `Communication-Enabled`, splitting only when exceeding line capacity and without injecting artificial spaces.
  - Added overflow tolerance guard to avoid 1-character orphan lines and natural numerical sub-splitting for standards like `802.11b/g/n`.
- **Verification**:
  - `npm run typecheck`: 0 errors.
  - `npm run build`: Vite production build passed cleanly in 2.66s.

---

## [#030] [2026-09-12] - Visualizer Studio: Mathematical Category Span Resolution, 100% Y-Axis Title Visibility & Extended Typography Customization

### Bug Fixes & Publication Layout Quality
- **Exact Category Label Span Calculation (`estimateCategoryLabelSpan`)**:
  - Resolved root cause of invisible Y-axis title ("RQ2 Operational Domain") on Horizontal Bar & Scatter and other horizontal charts when set to "Middle / Center" with compact margins.
  - Implemented `estimateCategoryLabelSpan` to dynamically measure the true rendered text width across multi-line category labels instead of assuming a constant 148px clearance.
  - Formulated title distance `titleGap = labelSpan + rawTitleGap + halfTitleThickness - offsetX`, ensuring the title is placed right at the user's configured Gap from the leftmost category label.
- **Safe Margin Clearance Clamp (`resolveUniversalGrid`)**:
  - Enforced `minRequiredTitleSpace = Math.round(titleThicknessY + titleGapY + 14)` on `grid.left`, mathematically guaranteeing that the Y-axis title is never pushed off-canvas into negative coordinates even when left margin is set to 0px.
- **Extended Axis Title Customization Suite (`ScientificAxisConfigPanel.tsx`, `types.ts`, `defaultConfigs.ts`, `useVisualizerConfig.ts`)**:
  - Added collapsible Extended Customization panel for both X and Y axis titles.
  - Introduced Rotation Angle presets (for Y: `90° Standard`, `0° Horizontal`, `270° Inverted`, `-90°`; for X: `0°`, `45°`, `90°`, `-45°`) and interactive `-180°` to `180°` slider.
  - Added Title Alignment (`Left`, `Center`, `Right`), dedicated Title Color Picker, Title Prefix/Suffix inputs, and Micro-Position Offsets ($X$ and $Y$ sliders from -60px to +60px with instant Reset).
- **Verification**:
  - `npm run typecheck`: 0 errors.
  - `npm run build`: Vite production build passed cleanly in 2.61s.

---

## [#029] [2026-09-12] - Visualizer Studio: Fixed Y-Axis Title Visibility for Top/End Location

### Bug Fixes & Publication Layout Quality
- **Location-Aware Title Gap Calculation (`axisConfigHelper.ts`)**:
  - Fixed issue where selecting "Top / End" on horizontal charts caused the Y-axis title to disappear off the top of the canvas.
  - Scoped horizontal label clearance additions solely to `middle` location, allowing `Top / End` and `Bottom / Start` to respect small user gaps (5px–15px) directly.
  - Added `align: 'right'` and `verticalAlign: 'bottom'` styling for `Top / End` titles, positioning them right above the category labels column.
- **Verification**:
  - `npm run typecheck`: 0 errors.
  - `npm run build`: Vite production build passed cleanly in 2.65s.

---

## [#028] [2026-09-12] - Visualizer Studio: Eliminating False Clearance Offsets to Enable Zero/Compact Left Margins

### Bug Fixes & Publication Layout Quality
- **Direct Pixel Margins with `containLabel: true` (`axisConfigHelper.ts`, `categoricalBarGenerators.ts`)**:
  - Removed artificial `190px` clearance minimum on horizontal charts that prevented users from decreasing empty space on the left.
  - Eliminated legacy percentage scaling on margins $\le 40$, allowing users to slide down to `Left (0px)` or choose compact presets (20px–30px) for tight column layouts.
  - With `containLabel: true`, ECharts automatically accommodates Y-axis title and labels within the chart bounds, and setting `Left (0px)` places the title flush against canvas padding without unused void.
- **Verification**:
  - `npm run typecheck`: 0 errors.
  - `npm run build`: Vite production build passed cleanly in 4.75s.

---

## [#027] [2026-09-12] - Visualizer Studio: Resolved Grid Margin Unit Collision & Category Label-Title Anti-Collision

### Bug Fixes & Publication Layout Quality
- **Standardized Pixel-Based Margins (`HorizontalBarScatterConfigPanel.tsx`, `useVisualizerConfig.ts`, `defaultConfigs.ts`)**:
  - Eliminated unit mismatch where Section 7 margin sliders rendered percentages (`{barGridRight}%`) while storing pixel values (e.g. 324px, 48px).
  - Converted Left and Right Margins to explicit pixel sliders (`px`) with safe ranges (`60px–400px` for left margin, `20px–240px` for right margin).
  - Fixed default margin resolution across config hooks to ensure consistent 200px base left clearance.
- **Category Label & Y-Axis Title Anti-Collision (`axisConfigHelper.ts`, `categoricalBarGenerators.ts`)**:
  - Guaranteed `minRequiredGap = minLabelClearance + Math.max(16, titleFontSize + 4)`, ensuring the Y-axis title ("RQ2 Operational Domain") never collides or overlaps into category labels.
  - Automatically resolved category word break artifacts (e.g. "Manufac / t / uring") by restoring proper horizontal drawing clearance.
- **Verification**:
  - `npm run typecheck`: 0 errors.
  - `npm run build`: Vite production build passed cleanly.

---

## [#026] [2026-09-12] - Visualizer Studio: Decoupled Publication Clearance & True Title Movement on Y-Axis Title Gap

### Bug Fixes & Precision Layout
- **Decoupled Universal Grid Clearance (`axisConfigHelper.ts`, `categoricalBarGenerators.ts`)**:
  - Fixed bug where sliding Y-Axis Title Gap shifted the entire chart grid across the canvas rather than moving the axis title.
  - Decoupled `requiredYTitleClearance` from `axisTitleGapY`, basing base grid clearance on category label width (`effectiveLabelWidth + effectiveLabelMargin`) and typography padding.
- **Bounded Anti-Collision Title Positioning (`axisConfigHelper.ts`)**:
  - Standardized `nameGap` on horizontal category axes to smoothly offset from category labels and clamp against the canvas left boundary.
  - Ensures the Y-axis title moves responsively relative to labels while the chart remains anchored in place.
- **Verification**:
  - `npm run typecheck`: 0 errors.
  - `npm run build`: Vite production build passed cleanly.

---

## [#025] [2026-09-12] - Umbrellanized Value & Taxonomy Induction Justification in Final Cohort Modal and Table

### Features & Transparency
- **Umbrellanized Value & Justification Rendering (`CohortPaperDetailsModal.tsx`)**:
  - Wired `getUmbrellanizerJustification` from `taxonomy-resolver.ts` to resolve and display taxonomy induction rationales for extracted research questions.
  - Implemented dual-card display separating **Umbrellanized Value (Canonical Taxonomy)** from **Raw Extracted Literal Token(s)** with monospace token badges.
  - Added dedicated purple/indigo **Umbrellanizer Taxonomy Justification** card with 1-click copy and arrow mapping (`rawToken → mappedCategory: "justification"`) for multi-token concepts.
  - Enhanced search filter to scan across Umbrellanizer justifications in addition to variable names, raw tokens, and mapped categories.
- **Table Cell Hover Transparency (`ClickableCell.tsx`)**:
  - Connected `traceInfo` justification into `ClickableCell` to render multi-line native tooltips showing Umbrellanized Value, Raw Token, Taxonomy Justification, Extraction Mapping, and Evidence Quote upon cell hover.
- **Verification**:
  - `npm run typecheck`: 0 errors.
  - `npm run build`: Production bundle built cleanly with Vite.

---

## [#024] [2026-09-12] - Final Cohort Detailed Paper Modal Quality Appraisal (QA) Score Calculation & Verbatim Quote Display

### Bug Fixes & Rendering Precision
- **QA Score Summation & Parsing (`CohortPaperDetailsModal.tsx`)**:
  - Resolved issue where the Quality Appraisal header badge and modal tab persistently displayed `0 / 8.0` due to `total_score` / `overall_score` not being top-level keys in Scientist Stage 3 evaluation payloads.
  - Implemented dynamic criterion score parser summing all individual criterion evaluations (`calculatedSum += numVal`), supporting decimal strings (`"1.0"`, `"0.5"`), booleans (`"YES"`, `"TRUE"`), and nested object structures (`criterion.score`, `criterion.value`).
  - Added multi-level fallback order: explicit total score > calculated dynamic sum > paper summary metadata (`Overall_QA`).
- **Verbatim Evidence Quotes & Appraisal Reasoning**:
  - Wired extraction of both rationale (`reasoningTrace[k + '_analysis'] || reasoningTrace[k]`) and verbatim literature evidence quotes (`criterion.exact_quote || criterion.evidence`).
  - Rendered highlighted evidence quote blockquotes under each evaluated criterion card in the Quality Appraisal tab.
- **Verification**:
  - `npm run typecheck`: 0 errors.
  - `npm run build`: Production bundle built cleanly with Vite.

---

## [#023] [2026-09-12] - Complete 19-Chart Customization Audit, Parameter Wiring & Publication Precision

### Customization Feature Wiring & Academic Aesthetics
- **Pie / Donut Slice Sorting & Slice Geometry (`pieSort`, `pieStartAngle`, `pieMinAngle`)**:
  - Added `pieSort` ('desc', 'asc', 'none') dropdown to `PieDonutConfigPanel` allowing users to sort slices deterministically by value or preserve original category order.
  - Added `pieStartAngle` (0°–360°) and `pieMinAngle` (0°–20°) sliders, preventing small proportion slices from collapsing or overlapping labels.
  - Wired parameters into `generatePieDonutOption` series configuration.
- **Continuous Scatter Data Labels & Markers (`scatter`)**:
  - Wired Universal Data Label controls (`showDataLabels`, `universalLabelPosition`, `universalLabelFontSize`, `universalLabelColor`, `labelFormat`) directly into `generateScatterOption`, allowing points to display title and coordinates.
- **Categorical Matrix & 3D Bubble Styling (`bubble`)**:
  - Mode B (Numerical 3D): Wired bubble border styling (`bubbleBorderColor`, `bubbleBorderWidth`) and data labels (`bubbleShowLabels`, `labelFormat`, `bubbleLabelColor`).
  - Mode A (Categorical Matrix): Synchronized `labelConfig.show` with studio Universal Data Labels toggle (`ctx.showDataLabels !== false`).
- **Boxplot Distribution Colors (`boxplotFillColor`, `boxplotBorderColor`)**:
  - Added color pickers to `BoxplotConfigPanel` for custom box fill and border colors.
  - Wired `boxplotFillColor` and `boxplotBorderColor` to boxplot series `itemStyle` in `generateBoxplotOption`.
- **Network Graph Interactive Draggability & Node Scale (`graphNodeSize`, `graphDraggable`)**:
  - Added Base Node Size slider (`graphNodeSize`: 8px–50px) and Draggable Vertices toggle (`graphDraggable`) to `GraphConfigPanel`.
  - Wired `draggable: ctx.graphDraggable !== false` and dynamic `symbolSize` to `generateGraphOption` force-directed graph series.
- **Gauge Metric Units & Scale Intervals (`gaugeUnit`, `gaugeSplitNumber`)**:
  - Added Metric Unit Suffix selector (`gaugeUnit`: Auto, %, cit, pts, papers, none) and Scale Split Intervals slider (`gaugeSplitNumber`: 2–10) to `GaugeConfigPanel`.
  - Replaced hardcoded `{value}%` detail formatter with dynamic suffix formatting (`avg_citation` and `avg_qa` default to raw units or custom suffixes, while ratios default to `%`).
- **Calendar Publication Date Extraction & Scientific Color Palettes (`calendarColorPreset`)**:
  - Overhauled date extraction in `generateCalendarOption` to prioritize `Publication_Date`, `publication_date`, `Date`, and 4-digit `Year` before ingestion timestamps (`created_at`, `imported_at`).
  - Added Heat Color Theme selector (`calendarColorPreset`) supporting standard scientific colormaps: Academic Blue/Slate, Viridis Scientific, Plasma High-Contrast, Thermal Heatmap, and Cool-Warm Divergent.
- **Verification**:
  - `npm run typecheck`: 0 errors.
  - `npm run build`: Production bundle built cleanly with Vite in 2.54s.

---

## [#022] [2026-09-12] - Fix Vertical Bar Category Legend, Boxplot Tooltip Indexing, Clustered Error Bars, and Line Marker Controls

### Bug Fixes & Rendering Precision
- **Vertical Bar Category Legend (`generateVerticalBarOption`)**:
  - Appended zero-radius dummy pie series to Cartesian vertical bar charts to ensure category swatches appear in the ECharts legend when "Show Legend" is toggled.
  - Bound solid hex `color` to `legendData` swatches to prevent SVG pattern image objects from corrupting the legend icons under academic monochrome hatching mode.
- **Vertical Bar Grid Step Interval Control (`VerticalBarConfigPanel`)**:
  - Replaced duplicate `barGap` slider in Section 3 with scientific `barValueInterval` (Grid Step Interval) input.
- **Boxplot 5-Number Summary Tooltip Indexing Bug (`generateBoxplotOption`)**:
  - Corrected 1-off array offset in boxplot tooltip formatter that caused Min to display Q1, Q1 to display Median, Median to display Q3, Q3 to display Max, and Max to display `undefined`.
- **Clustered Bar Error Bars Rendering (`generateClusteredBarOption`)**:
  - Implemented custom series I-beam error bars with precise lateral cluster offsets (`(sIdx - (seriesCount - 1) / 2) * step`) across both horizontal and vertical orientations.
- **Trend Line Marker Symbol Selector (`LineConfigPanel`)**:
  - Added Marker Symbol dropdown to `cohort_trend` mode in addition to simulation mode.
- **Calendar Legend Visibility in Universal Panel (`UniversalFineTunePanel`)**:
  - Enabled Legend & Series Keys toolbox for `calendar` charts to configure visualMap continuous scale bars.
- **Verification**:
  - `npm run typecheck`: 0 errors.
  - `npm run build`: Production bundle built cleanly with Vite.

---

## [#021] [2026-09-12] - Full Audit and Wiring of All 19 Chart Customizations in Scientific Visualization Studio

### Bug Fixes & Wiring Parity
- **Funnel Sorting & Label Placement (`funnelSort`, `funnelLabelPosition`)**:
  - Added missing `funnelSort` and `funnelLabelPosition` across `SlotConfig`, `DEFAULT_SLOT_CONFIG`, `useVisualizerConfig`, `VisualizerProvider`, `ChartGeneratorContext`, and `BuildChartOptionParams`.
  - Removed `as any` typing in `FunnelConfigPanel.tsx`, bound label placement, added sorting dropdown, and updated `generateFunnelOption` to sort dataset and apply `sortMode`.
- **Vertical & Horizontal Bar Chart Error Bars & Texture Hatching**:
  - Added Academic Texture Hatching (`enableHatchPatterns`) and Scientific Error Bars (`enableErrorBars`, `errorBarType`) controls to `VerticalBarConfigPanel` and `HorizontalBarConfigPanel`.
  - Implemented `barSorting` ('desc', 'asc', 'none'), `barWidth: ctx.barThickness`, `barCategoryGap: ${ctx.barGap}%`, `borderRadius: [ctx.barBorderRadius, ...]`, target benchmark line (`markLine`), monochrome hatch patterns (`getSeriesPatternStyle`), and custom I-beam error bar series (`computeGroupStatistics`, `getErrorBounds`) in `generateVerticalBarOption`.
  - Fixed sorting order bug in `generateHorizontalBarOption` (`desc` -> `valB - valA` and `asc` -> `valA - valB` due to inverted Y-axis).
- **Clustered Bar Chart Hatch Patterns (`clustered_bar`)**:
  - Fixed series `itemStyle` in `generateClusteredBarOption` to preserve and apply computed monochrome texture hatch pattern styles (`...patternStyle`) and `borderRadius`.
- **Continuous & Categorical Scatter Customizations (`scatter`)**:
  - Extended `ScatterConfigPanel` and `generateScatterOption` to wire Point Symbol (`scatterSymbol`: circle, diamond, rect, triangle, roundRect, pin), Point Color (`scatterColor`), Border Color (`scatterBorderColor`), and Border Width (`scatterBorderWidth`).
- **Horizontal Boxplot Jitter Scatter Coordinates (`boxplot`)**:
  - Fixed coordinate inverted coordinate bug in `generateBoxplotOption` when `boxplotOrientation === 'horizontal'` so that points correctly map `[val, cIdx + jitter]` to Cartesian axes and tooltip inspects value at `params.data[0]`.
- **Radar / Spider Chart Data Labels (`radar`)**:
  - Updated `generateRadarOption` across prevalence, tag share, multi-variable, and QA breakdown series to honor `ctx.showDataLabels === true || ctx.radarShowDataLabels === true`.
- **Trend Line Marker Symbols (`line`)**:
  - Fixed cohort trend mode in `generateLineOption` to cleanly bind `symbol: ctx.lineMarkerSymbol || 'circle'`.
- **Universal Effect Controls & Canvas Margin Scope (`UniversalFineTunePanel`)**:
  - Updated `hasCartesianAxes` to include `horizontal_bar_scatter`, expanded `hasDataLabels` to include `horizontal_bar_scatter`, `radar`, and `graph`, and enabled Legend and Canvas Layout & Margins toolboxes for `horizontal_bar_scatter`.
- **Verification**:
  - Confirmed 0 TypeScript type errors (`npm run typecheck`).
  - Generated clean production bundle with Vite (`npm run build`).

---

## [#020] [2026-09-12] - Fix Infinite Backend Call Loop on Opening Chart Library Modal

### Bug Fixes & Stability
- **Reference-Stable Fetch Hooks (`ChartLibraryModal.tsx`)**:
  - Replaced inline default array parameter `viewerSavedCharts = []` with module-scoped constant `EMPTY_SAVED_CHARTS: SavedChart[] = []` to prevent allocating new array references on each render.
  - Decoupled `viewerSavedCharts` from `useCallback` dependency array by using `viewerSavedChartsRef = useRef(viewerSavedCharts)` (AGENTS.md Rule 3.3).
  - Added concurrency guard `isFetchingRef = useRef(false)` preventing overlapping network requests.
  - Stabilized `fetchCharts` dependencies to purely primitive values `[isOpen, isViewerMode, projectId]`, eliminating recursive infinite `useEffect` executions.
  - Mirrored `onLoadPreset={presets.loadPresetPayload}` stabilization across `VisualizerHeader.tsx` and `ExportPanel.tsx`.
- **Verification**:
  - Confirmed 0 TypeScript type errors (`npm run typecheck`).
  - Production bundle generated with Vite (`npm run build`, v1.1.32).

---

## [#019] [2026-09-12] - Deep Code Analysis & Hidden Bug Hunt Verification for Scientific Visualization Studio & Inspection Subsystems

### Bug Fixes & Hardening
- **Offline Chart Deletion Tombstoning (`ChartLibraryModal.tsx`)**:
  - Eliminated snapshot chart resurrection upon session reload by persisting tombstoned IDs in `localStorage` under `slr_viewer_deleted_charts_${projectId}`.
  - Filtered tombstoned charts on load, recorded deletions, and removed tombstone if a chart with the same ID is saved anew.
- **Dexie IndexedDB Session Persistence (`FinalCohortPanel.tsx`)**:
  - Implemented `handleViewerSaveChart` and `handleViewerDeleteChart` in `FinalCohortPanel.tsx` updating `activeSession.rawData.saved_charts` via `StorageService.updateSession()`.
  - Updated `schemaValidator.ts` to cleanly preserve and sanitize `saved_charts` array during snapshot ingestion.
- **Fullscreen Paper Inspection Modal Parity (`CohortPaperDetailsModal.tsx`)**:
  - Mirrored nested `logic_trace` object unwrapping (`extraction_mapping` and `appraisal_reasoning`).
  - Added verbatim evidence quote extraction fallback using `extractEvidenceQuote`.
  - Guarded QA score parsing for string/numeric formats and supported string trace rationales.
  - Mirrored `"Paper Documentation & Sourced Records"` label and Local PDF status fallback.
- **Visualizer Studio Mechanics & Navigation Bounds**:
  - Expanded parameter reset in `UniversalFineTunePanel.tsx` across all 19 chart categories.
  - Added string ID comparison and strict boundary clamping in `FinalCohortPanel.tsx` paper navigation.
- **Verification**:
  - Confirmed 0 TypeScript type errors (`npm run typecheck`).
  - Generated clean production bundle with Vite (`npm run build`).
  - Updated `slr-viewer/files.md`.

---

## [#018] [2026-09-12] - FAIR Saved Charts Bundle Parity, Premiere Collapsible Toolboxes & Fullscreen Paper Inspection Modal

### Added & Enhanced
- **Project-Saved Charts Snapshot Sourcing & Offline Library**:
  - Implemented 100% offline project-saved charts parity by consuming `activeSession.rawData.saved_charts` in `FinalCohortPanel.tsx` and passing it to `VisualizerModal`.
  - Added live saved-charts count badge to the `Visualize Cohort` topbar button in `App.tsx` and the `Chart Library` button in `VisualizerHeader.tsx` to alert reviewers when project charts are available.
  - Enabled `ChartLibraryModal` in viewer mode with offline `localStorage` fallback, 1-click studio hydration, duplicate, delete, and legacy JSON preset import.
- **Adobe Premiere-Style Collapsible Toolboxes**:
  - Mirrored `CollapsibleToolbox.tsx` and overhauled `UniversalFineTunePanel.tsx` into 6 modular collapsible toolboxes with live status chips, enable/disable switches (fx toggles), and parameter resets.
  - Mirrored all 19 chart geometry panels, data label synchronizers, and publication export tools.
- **Comprehensive Fullscreen Paper Inspection Modal (`CohortPaperDetailsModal.tsx`)**:
  - Completely dropped legacy "View and copy cell value" and "View extraction logic trace" popovers from `ClickableCell.tsx` and `FinalCohortPanel.tsx`.
  - Integrated `CohortPaperDetailsModal` triggered via dedicated eye button, clicking paper ID/title, double-clicking rows, or table header button.
  - Features prominent "Open Cloud PDF" button linking to synced cloud full-text documents, alongside full Abstract card, Bibliographic metadata, Extracted RQs with canonical taxonomy and verbatim quotes, Quality Appraisal breakdown (8/8 criteria), and copyable Raw JSON payload.
  - Supports keyboard shortcuts (`ArrowLeft`, `ArrowRight`, `Esc`) and fullscreen toggle.
- **Verification**:
  - TypeScript typecheck passed with 0 errors (`npm run typecheck`).
  - Production build compiled cleanly (`vite build`, v1.1.29).
  - Updated `slr-viewer/files.md`.

---

### Added & Enhanced
- **Raw Extracted Value Display in Value Popover (`ClickableCell.tsx`)**:
  - Brought `ClickableCell` in `slr-viewer` into 100% parity with `slr-ide` by rendering the unmapped `originalValue` inside the "Copy Cell Value" popover whenever it is present and differs from `valueToCopy`.
  - Added dedicated "Original Value" sub-header, pre-wrapped scrollable content box, and 1-click copy button with animated confirmation state (`copiedType === 'original'`).
  - Restored full transparency for researchers to inspect and copy both post-Umbrellanizer canonical terms and original raw LLM extractions directly from final cohort tables.
- **Verification**:
  - Confirmed 0 TypeScript type errors (`tsc --noEmit`).
  - Generated clean production bundle in `dist/` with updated asset fingerprints (`npm run build:viewer`).
  - Updated `slr-viewer/files.md`.

---

## [#016] [2026-09-09] - Codebase Cleanup, Tree Shaking & Production Build Audit for GitHub Release

### Cleanup & Verification
- **Test Scripts Purge**: Removed scratch verification scripts and restored clean monorepo configuration in preparation for public GitHub release.
- **Service & Asset Synchronization**: Executed `npm run mirror:viewer` to ensure 100% parity across mirrored pure services (`taxonomy-resolver.ts`, `cohort-data-source.ts`, `trace-normalizer.ts`, `adjudication-calculations.ts`) and offline fonts.
- **Production Verification**:
  - Confirmed 0 TypeScript type errors (`npm run typecheck`).
  - Generated clean production bundle in `dist/` with updated asset fingerprints (`npm run build:viewer`).
  - Verified cataloging integrity in `slr-viewer/files.md`.

---

## [#015] [2026-09-09] - 1-Click Cross-Panel Navigation Across Research Workflow Flowchart Nodes

### Added & Enhanced
- **Interactive Cross-Panel Navigation in Research Workflow (`ResearchWorkflowPanel.tsx`)**:
  - Embedded direct 1-click cross-panel navigation across all 20 pipeline flowchart nodes (spanning all 5 groups: Database Builder & Ingestion, Pre-Calibration & Prompt Optimization, LLM & Manual Screening Pipeline, Post-Validation & Quality Audit, and FAIR Data Export & Reporting).
  - Configured precise navigation targets for each node (`insight-export-rigor`, `insight-export-screening-ledger`, `insight-export-cohort`, `insight-export-accounting`, and `insight-export-fair-data`).
  - Added dedicated navigation button in each flowchart grid card footer with `e.stopPropagation()`, ensuring users can jump directly to the target tab while still being able to click the card body to open the telemetry inspection drawer.
  - Added a prominent Quick Navigation Callout Banner at the top of the slide-over inspection drawer (below the Live Telemetry Metric box) displaying the related workspace section, an informative description of what can be explored there, and a primary action button with an external link indicator.
  - Added a secondary "Go to [Section]" navigation button in the drawer footer for fluid scrolling ergonomics.
  - Integrated global toast notification (`showToast("Navigated to [Section]", "info")`) providing instant visual feedback on navigation.
- **Verification**:
  - TypeScript typecheck passed with 0 errors (`tsc --noEmit`).
  - All monorepo test suites passed 100% (`npm test`).
  - Clean production build verified (`vite build`, v1.1.24).

---

## [#014] [2026-09-09] - Multi-Source Systematic Search Queries & IEEE Xplore Ingestion Hub Transparency (PRISMA 2020 Item 7)

### Added & Enhanced
- **Multi-Source Systematic Search Queries in Node 1.2 (`ResearchWorkflowPanel.tsx`)**:
  - Upgraded **Node 1.2 (Literature Ingestion Hub)** from legacy hardcoded Scopus and Google Scholar cards to a dynamic multi-repository search strategy viewer.
  - Dynamically extracts and renders all documented database search strings from `project.search_queries` and `scientific_rigor.systematic_search_strategies.search_queries`, seamlessly displaying IEEE Xplore, Scopus, Google Scholar, Web of Science, ACM Digital Library, PubMed, etc.
  - Added repository-aware source badges and styling (`getDatabaseSourceStyle`) providing distinct visual hierarchy across IEEE Xplore (blue/indigo), Scopus (amber/orange), Google Scholar (emerald), Web of Science (purple), and ACM (cyan).
  - Added individual 1-click "Copy Query" buttons with toast feedback and 2-second confirmation state.
  - Added 1-click "Copy All" button allowing researchers and auditors to copy all documented search strategies with repository headers and filter notes in one click for PRISMA appendices.
  - Provided clean formatted syntax code blocks (`font-mono text-xs max-h-52 select-all`) with filter notes and parameters.
  - Maintained graceful backward compatibility: if only legacy strings (`scopus_search_string`, `manual_search_string`) exist, they automatically normalize into the new query card structure.
- **Enhanced SLR Viewer Snapshot Export (`slr-ide/src/app/api/export/slr-viewer/route.ts`)**:
  - Guaranteed `parsedSearchQueries` are exported into `project.search_queries` and embedded `systematic_search_strategies` at the top level and in `scientific_rigor`.
- **Automated Verification Suite**:
  - Added dedicated test suite `scripts/test-literature-ingestion-hub.mjs` (`npm run test:ingestion`) verifying repository extraction, dynamic rendering, PRISMA Item 7 compliance, and live SQLite `slr.db` data presence for IEEE Xplore.
  - Verified 0 TypeScript errors and clean production build (`v1.1.23`).

---

## [#013] [2026-09-09] - Interactive Pre-Calibration & Post-Validation Adjudication Transparency Hub

### Added & Enhanced
- **Interactive Pre-Calibration Adjudication Explorer (`BlindedAdjudicationPanel.tsx`)**:
  - Embedded an interactive adjudication and ground truth explorer directly within Section 1.5 of the Scientific Rigor page.
  - Implemented multi-pool selection pills: Pool A (Fast Filter, n=50), Pool B (Gatekeeper, n=30), and Pool C (QA & Miner, n=20).
  - Added sub-tab switching between **Cohort & Discrepancies** and the **Cryptographically Signed Calibration Ledger**.
  - Implemented dual-mode filtering: toggle between "Conflicts Only" and "All Paired Papers", with dynamic count badges.
  - Implemented full-text client search across Paper ID, Title, DOI, and Authors.
  - Rendered comprehensive paired reviewer comparison tables: Reviewer Alpha vs Reviewer Beta vs Adjudicated Consensus with color-coded decision badges and rationales.
  - Rendered immutable calibration audit ledger table featuring 7-char short commit hashes, one-click copy buttons, timestamps, adjudicator roles, and resolution commit messages.
- **Interactive Rolling Batch Adjudication & Micro-Audit Explorer (`RollingBatchPanel.tsx`)**:
  - Embedded micro-batch adjudication exploration directly beneath the sequential Wald/Fleiss-Cohen historical performance metrics in Section 3.
  - Added batch selector pills (`Batch #1 (n=20)`, `Batch #2 (n=20)`, etc.) with active batch synchronization.
  - Added sub-tab switching between **Sampled Papers & Discrepancies** and the **Cryptographically Signed Batch Commit Ledger**.
  - Enabled dual-mode filtering ("Conflicts Only" vs "All Sampled Papers (20)") with instant text search.
  - Rendered side-by-side QA decision summaries (e.g. `Include (6.5/8.0)` vs `Exclude (3.0/8.0)`) and consensus status across all 20 sampled papers.
- **Deep Side-by-Side Adjudication Inspection Modal (`AdjudicationInspectionModal.tsx`)**:
  - Built a comprehensive dual-pane inspection modal shared across Pool A, Pool B, Pool C, and Rolling Batches.
  - **Left Pane (Bibliographic & PRISMA Evidence)**: Displays Paper ID, publication year, title, authors, journal/source, clickable DOI and PDF links, full study abstract, and commit hash stamp.
  - **Right Pane (Blinded Rater Arbitration)**:
    - **Pool A & Pool B**: Rater Alpha vs Rater Beta vs Adjudicated Ground Truth (Decision, Exclusion Criteria codes, and detailed rationales).
    - **Pool C & Rolling Batches**: Sub-tabs for **Dual-Gate Quality Appraisal (QA1–QA8)** and **Structured Entity Mining (RQ1–RQ9)**.
    - Full rubric criteria breakdown with exact scoring rules, fatal flaw indicators, reviewer scores, reviewer evidence quotes, and adjudicated consensus.
    - Miner extraction view displaying entity keys, rater values, evidence quotes, and adjudicated values.
  - Modal includes keyboard navigation (Left/Right arrows for item cycling, Escape to close) and signed consensus commit footer.
- **Centralized Service & Calculator Mirroring (`scripts/mirror-to-viewer.mjs`)**:
  - Registered `adjudication-calculations.ts` and `AdjudicationInspectionModal.tsx` in `scripts/mirror-to-viewer.mjs` ensuring 100% sync between `slr-ide` and `slr-viewer`.
  - Upgraded `renderPoolCReviewerSummary` to accept both serialized JSON strings and parsed object payloads.
- **Verification**:
  - TypeScript check passed with 0 errors (`npm --prefix slr-viewer run typecheck`).
  - Production build succeeded cleanly (`npm --prefix slr-viewer run build`, v1.1.22).
  - All 4 monorepo test suites passed 100% (`npm test`).

---

## [#012] [2026-09-09] - Tailwind CSS v4 Class-Based Dark Mode Fix & Maximum Contrast Overhaul

### Fixed & Enhanced
- **Tailwind CSS v4 Dark Variant Selector Isolation (`index.css`)**:
  - Diagnosed critical root cause where `slr-viewer/src/index.css` lacked `@custom-variant dark (&:where(.dark, .dark *));`.
  - In Tailwind CSS v4, without this directive, all `dark:*` utility classes default to `@media (prefers-color-scheme: dark)`. Because developer/user operating systems frequently have Dark Mode enabled at the OS level, `@media (prefers-color-scheme: dark)` matched globally. Consequently, all pale/pastel `dark:*` text classes (`dark:text-amber-100`, `dark:text-emerald-200`, `dark:text-amber-400`) were inappropriately rendered on top of white/light card backgrounds (`#ffffff`), producing completely washed-out, illegible text in light mode.
  - Added `@custom-variant dark (&:where(.dark, .dark *));` directly after `@import "tailwindcss";`, properly scoping all `dark:*` utility selectors strictly to `:where(.dark, .dark *)`.
- **Deep Opaque Text Colors & Zero Opacity Transparency**:
  - Replaced semi-transparent text opacity (`text-emerald-800/80`, `text-amber-800/80`) with 100% opaque, high-contrast paired colors:
    - **Passed Steps / Cards**: `text-emerald-950 dark:text-emerald-200` (Title), `text-emerald-900 dark:text-emerald-300` (Description), `text-emerald-900 dark:text-emerald-300` (Status Tag), `text-emerald-700 dark:text-emerald-400` (Icon).
    - **Inaccessible PDF Steps / Cards**: `text-amber-950 dark:text-amber-200` (Title), `text-amber-900 dark:text-amber-300` (Description), `text-amber-900 dark:text-amber-300` (Status Tag), `text-amber-700 dark:text-amber-400` (Icon).
    - **Excluded Steps / Cards**: `text-rose-950 dark:text-rose-200` (Title), `text-rose-900 dark:text-rose-300` (Description), `text-rose-800 dark:text-rose-300` (Status Tag), `text-rose-700 dark:text-rose-400` (Icon).
- **PRISMA Phase 2b Warning Banner (`PaperInspectionModal.tsx`)**:
  - Upgraded header to `text-amber-900 dark:text-amber-300 font-black` with `text-amber-700 dark:text-amber-400` icon.
  - Body paragraph set to `text-amber-950 dark:text-amber-100 font-semibold leading-relaxed`.
- **Decision & Trigger Badges (`ScreeningLedgerPanel.tsx` & `PaperInspectionModal.tsx`)**:
  - Upgraded badges with deep contrast: `text-amber-900 dark:text-amber-300` (Unretrieved), `text-orange-800 dark:text-orange-300` (Duplicate), `text-emerald-900 dark:text-emerald-300` (Included), and `text-rose-800 dark:text-rose-300` (Excluded).
  - Upgraded Local PDF Status `INACCESSIBLE` badge to `text-rose-800 dark:text-rose-300 font-black`.
- **Verification**:
  - Verified built CSS: all `dark:*` selectors now compile to `:where(.dark, .dark *)` instead of `@media (prefers-color-scheme: dark)`.
  - All 5 test suites passed (`npm test`: 22/22 ledger tests, 42/42 visualizer tests).
  - Production build completed cleanly (`vite build`, v1.1.21).

---

## [#011] [2026-09-09] - High-Contrast Theme-Adaptive Typography & UI Coloring (Light & Dark Theme Parity)

### Fixed & Enhanced
- **High-Contrast Triggered Exclusion Criterion Card (`PaperInspectionModal.tsx`)**:
  - Eliminated washed-out, illegible pink-on-pink text in light theme where `text-rose-200/90` and `text-rose-300` had an inaccessible contrast ratio (< 1.5:1) against light backgrounds.
  - Replaced low-contrast classes with theme-adaptive typography: `text-rose-950 dark:text-rose-100` (10.5:1 contrast in light theme, 11:1 in dark theme), `bg-rose-500/10 dark:bg-rose-500/15`, `border-2 border-rose-500/30 dark:border-rose-500/40`, and `font-semibold`.
  - Replaced exclusion code badge with `font-black text-rose-800 dark:text-rose-200 bg-rose-500/20 border-rose-500/30`.
- **Theme-Adaptive Multi-Stage Screening Trajectory Stepper (`PaperInspectionModal.tsx`)**:
  - Upgraded stepper cards to theme-adaptive text and border scales:
    - **Excluded Nodes**: `text-rose-950 dark:text-rose-100`, step title `text-rose-900 dark:text-rose-200 font-black`, description `text-rose-800/80 dark:text-rose-300/80`, status tag `text-rose-700 dark:text-rose-300 border-rose-500/20`.
    - **Passed Nodes**: `text-emerald-950 dark:text-emerald-100`, step title `text-emerald-900 dark:text-emerald-200 font-black`, description `text-emerald-800/80 dark:text-emerald-300/80`, status tag `text-emerald-800 dark:text-emerald-300 border-emerald-500/20`.
    - **Retrieval Inaccessible**: `text-amber-950 dark:text-amber-100`, step title `text-amber-900 dark:text-amber-200 font-black`, description `text-amber-800/80 dark:text-amber-300/80`, status tag `text-amber-800 dark:text-amber-300`.
    - **Skipped / Unreached**: Removed artificial opacity haze (`opacity-60`), applying crisp `text-foreground/75 dark:text-foreground/70 font-bold` and subtle `bg-card/70 dark:bg-secondary/30`.
- **High-Contrast PRISMA Phase 2b & Phase 1 Warning Banners (`PaperInspectionModal.tsx`)**:
  - Inaccessible PDF banner upgraded to `text-amber-800 dark:text-amber-400 font-extrabold` header and `text-amber-950 dark:text-amber-100` body with `border-2 border-amber-500/30 dark:border-amber-500/40`.
  - Duplicate notice banner upgraded to `text-orange-800 dark:text-orange-400 font-extrabold` header and `text-orange-950 dark:text-orange-100` body with `border-2 border-orange-500/30 dark:border-orange-500/40`.
- **High-Contrast Decision Badges & Rationales (`PaperInspectionModal.tsx`)**:
  - Header decision badge uses deep, crisp text in light theme and vibrant pastel in dark theme: `text-rose-700 dark:text-rose-400` (EXCLUDE), `text-emerald-800 dark:text-emerald-400` (INCLUDE), `text-amber-800 dark:text-amber-400` (UNRETRIEVED), `text-orange-700 dark:text-orange-400` (DUPLICATE).
  - AI rationale box rendered in `text-[13px] text-foreground font-sans leading-relaxed` on `bg-secondary/40 dark:bg-secondary/30`.
  - Human reviewer evaluation card rendered in `text-amber-800 dark:text-amber-400` header with `text-amber-950 dark:text-amber-100` rationale on `bg-amber-500/10 dark:bg-amber-500/15`.
- **Screening Ledger KPI Cards & Table Cells (`ScreeningLedgerPanel.tsx`)**:
  - Replaced washed-out 400-level text in light mode across KPI buttons with high-contrast dual-theme classes: `text-orange-700 dark:text-orange-400`, `text-blue-700 dark:text-blue-400`, `text-amber-800 dark:text-amber-400`, `text-purple-700 dark:text-purple-400`, `text-rose-700 dark:text-rose-400`, `text-emerald-800 dark:text-emerald-400`, and `text-slate-700 dark:text-slate-400`.
  - Fixed legacy snapshot banner from low-contrast `text-amber-300` to `text-amber-900 dark:text-amber-300`.
  - Table stage badges and decision badges upgraded with dark/light paired color palettes (`text-*-700 dark:text-*-400`).
  - Table typography enhanced: Paper ID set to `select-text font-semibold`, Title set to `font-bold text-foreground text-xs`, Authors set to `text-foreground/80 dark:text-muted-foreground font-medium`, and Year set to `font-mono text-foreground font-bold`.
- **Verification**:
  - Production build compiled cleanly in 10.26s (`vite build`).
  - All 5 test suites passed (`npm test`: fonts, date, parity, ledger, visualizer, 22/22 ledger tests).

---

## [#010] [2026-09-08] - Strict PRISMA 2020 Stage Parity & Full-Text Retrieval Gate Audit

### Fixed & Enhanced
- **Deterministic PRISMA 2020 Phase Categorization (`ScreeningLedgerPanel.tsx`, `PaperInspectionModal.tsx`, `types/index.ts`)**:
  - Traced and resolved discrepancy between database `ai_decision = 'INCLUDE'` counts (82 papers) and PRISMA Final Included Cohort (46 papers). 36 papers passed Stage 1 Fast Filter but were halted at PRISMA Phase 2b (*Reports Not Retrieved*) due to inaccessible full-text PDFs (`Local_PDF_Status === 'INACCESSIBLE'`).
  - Traced duplicate exclusion collision where 1 duplicate record had `ai_stage = 1, ai_decision = 'EXCLUDE'`. Enforced pre-screening deduplication priority according to PRISMA 2020 standards, ensuring Stage 1 exclusions correctly equal exactly **937** non-duplicates.
  - Implemented deterministic `prisma_phase` resolution with strict mathematical partitioning across all 1,803 ingested papers:
    - **Pre-Screening Duplicates Purged**: 8
    - **Stage 1 Fast Filter Excluded**: 937
    - **Reports Not Retrieved (PDF Inaccessible)**: 36
    - **Stage 2 Gatekeeper Excluded**: 774
    - **Stage 3 Scientist QA Excluded**: 2
    - **Stage 4 Miner Final Included Cohort**: 46
    - **Total Non-Duplicate Excluded (S1+S2+S3)**: 1,713
    - **Exact Mathematical Partition**: $8 + 937 + 36 + 774 + 2 + 46 = 1,803$ (100.00% exact match to PRISMA flow diagram).
- **PRISMA-Grouped Interactive KPI Header (`ScreeningLedgerPanel.tsx`)**:
  - Redesigned top metric cards grouped by PRISMA stage with visual stage separators (`Pre-Screening`, `Phase 1: Title/Abstract`, `Phase 2a: Retrieval`, `Phase 2b: Full-Text`, and `Phase 3: Included`).
  - Added dedicated 1-click filter cards for `PDF Inaccessible (36)` and `Duplicates (8)`.
  - Fixed Unscreened filter behavior so it no longer forces `non-duplicates` when zero unscreened non-duplicates exist.
- **5-Stage Full-Text Retrieval Gate Visualizer (`PaperInspectionModal.tsx`)**:
  - Expanded paper inspection stepper to 5 steps, introducing the explicit `PDF Retrieval Gate` between Fast Filter and Gatekeeper.
  - Added PRISMA Phase 2b warning banner explaining the full-text acquisition failure rationale and showing the paper's Stage 1 inclusion status.
  - Added PRISMA Phase 1 duplicate notice banner for pre-screening purged records.
  - Differentiated header badge between `Stage 1 Include • PDF Inaccessible (Unretrieved)` (amber) and `FINAL INCLUDED` (emerald).
- **Automated Verification**:
  - Expanded `scripts/test-screening-ledger.mjs` with 8 PRISMA assertion tests validating exact cohort counts, duplicate isolation, and 100% partition coverage (22/22 tests passed).

---

## [#009] [2026-09-08] - Full Screening Corpus Transparency Suite ("Screening Ledger" & Paper Inspection Modal)

### Added
- **"Screening Ledger" Navigation Item (`Sidebar.tsx`, `App.tsx`)**:
  - Integrated new top-level navigation item `{ id: 'insight-export-screening-ledger', label: 'Screening Ledger', icon: Layers }` positioned directly above **Final Cohort** in the "Insight & Export" section.
  - Wired dedicated edge-to-edge view container (`p-0 flex flex-col h-full`) in `App.tsx` hosting `ScreeningLedgerPanel`.
- **Wide Tabular Data Grid (`ScreeningLedgerPanel.tsx`)**:
  - Built high-performance wide table displaying all 1,800+ input papers with independent scrolling and sticky header.
  - **KPI Summary Cards**: Quick-filter pills displaying Total Ingested (1,803), Total Excluded (1,714), Stage 1 Excluded (938), Stage 2 Excluded (774), Stage 3 Excluded (2), Final Included (46), Duplicates (8), and Unscreened.
  - **Comprehensive Multi-Field Search**: Real-time searching across Paper ID, Title, Authors, DOI, Abstract, Publisher, Exclusion Codes, and AI/Manual rationales.
  - **Multi-Attribute Filter Drawer**: Filters for Screening Stage (0 to 4), Decision (INCLUDE, EXCLUDE, UNSCREENED), Trigger Code (EC-1..EC-4), PDF Status (SYNCED, DOWNLOADED, MATCHED, MISSING, INACCESSIBLE, FAILED, IGNORED), Source Database (Scopus, WoS, IEEE, PubMed, Manual), Duplicates (Exclude, Include, Only), and Calibration Pool (Pool A, Pool B, Pool C, Non-calibration).
  - **12 Dynamic Columns**: Paper ID, Title, Authors, Year, DOI, Source, Stage badge, Effective Decision badge (with Human Override indicator), Exclusion Trigger, PDF Status dot/link, Citations, and Inspect action button.
  - **Column Resizing & Persistence**: Hover-active draggable column borders with `localStorage` persistence scoped per project.
  - **1-Click RFC 4180 CSV Export**: Integrated "Export CSV" button generating UTF-8 BOM (`\uFEFF`) spreadsheets of the entire screened literature corpus or filtered subsets.
- **Comprehensive & Beautiful Paper Inspection Modal (`PaperInspectionModal.tsx`)**:
  - Full-featured modal dialog (`max-w-5xl`, `h-[92vh]`) with smooth backdrop blur.
  - **4-Stage Visual Stepper**: Displays paper trajectory through Fast Filter, Gatekeeper, Scientist QA, and Miner Extraction, highlighting where exclusions occurred.
  - **Triggered Exclusion Criterion Card**: Surfaces rule code and full rule description.
  - **Side-by-Side Rationale Comparison**: AI Screening Rationale contrasted with Human Reviewer Evaluation.
  - **Multi-Stage Audit History**: Chronological run timeline detailing stage, model ID, tokens, latency, and cost per screening execution.
  - **Abstract & Provenance Tab**: Full scrollable paper abstract with word count, 1-click copy, and bibliographic provenance metadata.
  - **Evaluation Data Tab**: Formatted JSON syntax views for Stage 3 QA scores and Stage 4 Miner extraction variables.
  - **Rapid Audit Navigation**: Keyboard arrow keys (`Left`/`Right`), `Escape` dismissal, and Prev/Next buttons for auditing papers sequentially without closing the modal.
- **Schema Validation & Backwards-Compatible Storage (`schemaValidator.ts`, `StorageService.ts`)**:
  - Validates and sanitizes `screened_corpus` with graceful fallback for legacy v1.1.0/v1.2.0 snapshots.
  - Tracked `totalCorpusCount` in `SessionRecord` and enhanced `Dashboard.tsx` session cards to display both final cohort count and total screened corpus count.
- **Automated Verification**:
  - Tested with `scripts/test-screening-ledger.mjs` verifying 1,803 papers, stage-dominant decision resolution, screening audit logs, and component mountings (17/17 passed).

---

## [#008] [2026-09-08] - Fix Accounting Top Expensive API Calls "Invalid Date" Timestamp Parsing

### Fixed
- **Resilient Timestamp Helper Suite (`AccountingPanel.tsx`)**:
  - Resolved critical display defect where the `TIMESTAMP` column rendered `"Invalid Date"` across all rows in the Accounting panel.
  - Implemented `parseTimestampToMs` and `formatTimestampSafe` handling ISO-8601 strings, SQLite space-separated datetime strings (converts space to `'T'` and appends timezone `'Z'`), numeric epoch timestamps, and null/empty states with graceful fallbacks.
  - Resolved attribute naming discrepancy by dynamically inspecting `call.created_at || call.timestamp || call.time || call.date`.
- **Safe Date Formatting in Rolling Batch Panel (`RollingBatchPanel.tsx`)**:
  - Upgraded date rendering for `batch.finalized_at` and `batch.created_at` with `formatDateSafe`, eliminating potential invalid date errors on SQLite date strings.
- **Automated Verification**:
  - Tested with `scripts/test-date-parsing.mjs` verifying 100% valid formatted dates and zero `"Invalid Date"` occurrences across all supported formats.

---

## [#007] [2026-09-08] - Self-Hosted Offline Publication Font Suite & Zero CDN Network Leakage

### Added
- **Self-Hosted WOFF2 Publication Assets (`public/fonts/`)**:
  - Mirrored full publication font suite (20 optimized `.woff2` files) from `slr-ide` via `scripts/mirror-to-viewer.mjs`.
  - Guarantees 100% offline rendering parity across Windows, macOS, and Linux without depending on local OS font availability or external network CDNs.
  - Bundled families: `Computer Modern`, `STIX Two Text`, `Carlito`, `EB Garamond`, and `Roboto`.
- **Offline `@font-face` Declarations (`index.css`)**:
  - Declared full `@font-face` blocks for all 5 core academic typefaces in `src/index.css`.
  - Verified 0 external HTTP/HTTPS CDN links in CSS, fulfilling strict airgap and FAIR data requirements.
- **Automated Verification**:
  - Integrated into monorepo test runner (`npm run test:fonts` / `npm test`).
  - Successfully built production Vite bundle with all font assets preserved in `dist/fonts/`.

---

## [#006] [2026-09-08] - Fix Visualizer Studio Data Sourcing & Taxonomy Resolution Across Bundled Datasets

### Fixed
- **Isomorphic Data Resolution Architecture (`taxonomy-resolver.ts`)**:
  - Implemented multi-type inspector `isNonEmptyPayload` in `taxonomy-resolver.ts` that safely validates both raw SQLite JSON strings (from `slr-ide`) and parsed JavaScript objects (from exported `.slr-viewer` snapshot bundles).
  - Fixed root cause bug where `getStageDominantExtractedDataStr` checked `typeof str === 'string'`, erroneously returning `""` for object payloads and collapsing all Visualizer Studio charts (Sankey, Sunburst, Treemap, Clustered Bar, Radar, Cross-Tab Matrix) into `Unspecified (~100%)`.
  - Added centralized `getStageDominantQualityAssessmentStr` helper to provide symmetrical, stage-dominant QA score resolution for both string and object formats.
- **Stage Dominance & Centralized Utility Enforcement (`AGENTS.md` §3.6 & §3.10)**:
  - Eliminated islanded local parsing fallbacks in `LlmContextBuilderModal.tsx` and `FinalCohortPanel.tsx` by importing and calling centralized `getStageDominantExtractedDataStr` and `getStageDominantQualityAssessmentStr`.
  - Preserved strict stage-aware dominance (`MAX(manual_stage, ai_stage)`) and tie-breaking (`manual_stage >= ai_stage`).
- **Safety Audit False-Positive Prevention (`cohort-data-source.ts`)**:
  - Normalized object and string representations in `validateCohortDataIntegrity` before equality assertions, eliminating false-positive stage dominance violation flags on bundled datasets.
- **Automated Verification**:
  - Created standalone parity test suite `scripts/test-data-sourcing-parity.mjs` verifying string/object parity, stage dominance overrides, variable discovery, field resolution, and 0% "Unspecified" guarantee in Sankey flows (13/13 tests passing).
  - All 42 visualizer anti-regression unit tests passing without errors.

---

## [#005] [2026-09-08] - Full Feature & Service Parity with SLR IDE (PDF/SVG Vector Engine, Systematic Search Strategy, Scientific Rigor LLM Context Builder, Taxonomy Mappings Export & Study Prevalence Deduplication)

### Added
- **Client-Side PDF & SVG Vector Export Engine**:
  - Integrated `jspdf` and `svg2pdf.js` into `slr-viewer/package.json`.
  - Mirrored `pdf-export-service.ts`, `prisma-svg-generator.ts`, and `cohort-data-source.ts` via `scripts/mirror-to-viewer.mjs`.
  - Enables 1-click vector SVG and high-resolution PDF exports directly in the standalone viewer for PRISMA 2020 flow diagrams.
- **Systematic Search Strategy & Queries Disclosure (PRISMA 2020 Items 6 & 7)**:
  - Updated snapshot export route (`/api/export/slr-viewer`) to extract structured `systematic_search_strategies` from `project.search_queries` (with legacy fallback).
  - Hardened `schemaValidator.ts` in `slr-viewer` to validate and preserve `systematic_search_strategies` across `scientific_rigor` and `prisma_flow_data`.
- **Scientific Rigor LLM Context Builder Modal & Top Action Bar**:
  - Mirrored `ScientificRigorLlmModal.tsx` into `slr-viewer` supporting offline standalone execution with `initialData`.
  - Added "PRISMA 2020 Validated" badge, 1-click "Download Rigor JSON" action, and "Extract LLM Context" launcher in `ScientificRigorPanel.tsx`.
- **Post-Pipeline Taxonomy Mappings Export in FAIR Data Hub**:
  - Implemented 3rd export card in `FairDataExportPanel.tsx`: "Umbrellanizer Taxonomy Mappings Export".
  - Generates RFC 4180 CSV (with UTF-8 BOM `\uFEFF`) and structured JSON client-side, compiling raw-to-umbrella mappings, justification notes, occurrence frequencies, and paper citations.
- **Unique Study Prevalence Deduplication**:
  - Applied `Array.from(new Set(...))` deduplication per study across `FinalCohortPanel.tsx` and `csv-export.ts`, guaranteeing multi-token categories report unique study prevalence accurately without duplicate counts.

### Changed
- Extended automated mirroring pipeline (`scripts/mirror-to-viewer.mjs`) to synchronize all newly required pure services and modals.
- Clean build verification with 0 TypeScript compiler errors (`tsc --noEmit`) and successful production bundling (`vite build`).

---

## [#004] [2026-08-16] - Blinded Review & Adjudication Results Panel Parity and Snapshot Schema Support

### Added
- **Blinded Review & Adjudication Results (`BlindedAdjudicationPanel.tsx`)**:
  - Mirrored `BlindedAdjudicationPanel.tsx` from `slr-ide` into `slr-viewer/src/components/scientific-rigor/`.
  - Integrated into `ScientificRigorPanel.tsx` directly under **Pre-Calibration Filling Status** and above **Gold Standard vs AI Stage Comparisons**.
  - Displays Cohen's Kappa, Observed Agreement, Expected Chance Agreement, Precision, Weighted Kappa, Schema Match %, and Adjudication Resolution progress complete with rich hover tooltips across all 3 pools.
- **Snapshot Export/Import Parity (`schemaValidator.ts`)**:
  - Updated `slr-viewer/src/utils/schemaValidator.ts` to recognize and preserve `scientific_rigor.blinded_adjudication_stats`.
  - Added support for `.slr-viewer` exported bundles containing pre-computed blinded review statistics and adjudication resolutions.

---

## [#003] [2026-08-15] - Granular & Bulk Copy Functionality for Project Governance (1.1) and Frozen Prompts (2.4)

### Added
- **1.1 Project Metadata & Governance Copy Actions**:
  - Master **Copy Full Spec** button at the top of the 1.1 drawer exporting structured Markdown of the entire governance manifesto, objectives, RQs, ECs, and QA rubrics.
  - Granular copy buttons on Project Name, Description, Research Manifesto, Research Objective, and Research Questions.
  - **Exclusion Criteria**: "Copy All ECs" section button plus individual copy buttons on every EC criterion card.
  - **Quality Assurance & Fatal Flaw Gates**: "Copy All QA Rules" section button, full rule copy buttons on every QA gate, and granular copy buttons on individual score tiers (Score 1.0 Full Pass, Score 0.5 Partial, Score 0.0 Fail, and Generic Score Definitions).
- **2.4 Frozen Prompt & Schema Mount Copy Actions**:
  - Registry header **Copy All Templates** button exporting all registered prompt templates into structured Markdown.
  - Per-template **Copy Template** button compiling full template metadata, stage badges, system instructions, user prompts, and response JSON schemas.
  - Individual copy buttons on System Instruction, User Template Prompt, and Response JSON Schema code blocks.
- **Dynamic Clipboard Feedback System**:
  - Centralized `handleCopy` helper with dynamic key-based 2-second auto-resetting checkmark indicator pill (`isCopied` state transition).
  - Synchronized global toast notification alerts using `ViewerContext.showToast`.

---

## [#002] [2026-08-15] - Fix Multi-Project Snapshot Export Scoping & Ingestion Hydration

### Fixed
- **Project Selection & Scoping**:
  - `slr-ide` export endpoint (`/api/export/slr-viewer`) now strictly respects `projectId` and `ACTIVE_PROJECT_ID` configs rather than defaulting to the first alphabetical project.
  - SQL queries for cohort papers, calibration papers, and rolling batches now enforce dual string/number matching (`WHERE Project_ID = ? OR CAST(Project_ID AS TEXT) = CAST(? AS TEXT)`).
- **Viewer Hydration & Session State**:
  - Updated `ViewerContext.tsx` and `ImportWorkflow.tsx` to refresh the session list immediately and switch active workspace seamlessly upon importing `.slr-viewer` snapshot files.
  - Resolved `PoolMetricsPanel.tsx` property lookups to support `activeProj.pool_a_count` / `activeProj.pool_a_size` directly.
  - Cleaned duplicate toolbar header controls from `FinalCohortPanel.tsx`.

---

## [#001] [2026-08-15] - SLR Viewer TypeScript Upgrade, Dual-Mode Compression & Code Mirroring Pipeline

### Added
- **TypeScript Infrastructure**:
  - Upgraded the entire `slr-viewer` codebase to React 19 + TypeScript (`tsconfig.json`, `vite-env.d.ts`, `vite.config.ts`).
  - Added `@/*` path aliasing matching `slr-ide` for 1:1 component import interoperability.
- **Automated Code Mirroring Pipeline (`scripts/mirror-to-viewer.mjs`)**:
  - Automatic synchronization of 40+ files from `slr-ide` into `slr-viewer` before every dev and build run (`predev` and `prebuild` hooks).
  - Synchronizes pure services (`cohort-metrics.ts`, `taxonomy-resolver.ts`, `trace-normalizer.ts`), data types (`types/index.ts`), complete visualizer module (18 chart generators, hooks, constants, utilities), and feature panels (`PrismaFlowDiagram.tsx`, `AccountingPanel.tsx`, `StageComparisonPanel.tsx`, `PoolMetricsPanel.tsx`).
- **Dual-Mode Compressed Interchange**:
  - Browser-native transparent compression & decompression (`src/utils/compression.ts`) using `CompressionStream('gzip')` and `DecompressionStream('gzip')`.
  - Achieves ~90% file size reduction for `.slr-viewer` snapshot exchanges with graceful fallback to uncompressed JSON.
  - Server export route in `slr-ide` (`src/app/api/export/slr-viewer/route.ts`) produces Gzip-compressed binary payloads by default with optional `?compressed=false` flag.
- **Online Presentation & Remote Loading**:
  - Added URL parameter ingestion (`?url=https://.../dataset.slr-viewer`) in `ViewerContext.tsx` to load remote datasets automatically upon landing on the GitHub Pages deployment.
- **Root Monorepo Automation**:
  - Added root `package.json` with scripts `npm run mirror:viewer`, `npm run build:viewer`, `npm run build:ide`, `npm run build:all`.

### Changed / Refactored
- Converted all 16 UI components in `slr-viewer` from `.jsx`/`.js` to `.tsx`/`.ts`.
- Removed all legacy duplicate `.jsx`/`.js` files.
- Verified zero TypeScript compilation errors (`tsc --noEmit`) and successful static production bundling (`vite build`) targeting `/SLR-Magic/slr-viewer/dist/`.
