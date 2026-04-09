/**
 * ConfigManager.js
 * Manages configuration using Script Properties instead of a sheet.
 * Includes migration logic from legacy 00_manifest.
 */

const ConfigManager = (function () {

  const MODEL_OPTIONS = [
    "gemini-3-pro-preview",
    "gemini-3-flash-preview",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite"
  ];

  const THINKING_LEVEL_OPTIONS = ["minimum", "low", "medium", "high"];

  // Define defaults here, matching Setup.js logic
  const DEFAULTS = {
    "LLM_API_PROVIDER": "Gemini",
    "API_KEY": "",
    "VLLM_API_URL": "",
    "OLLAMA_API_URL": "",
    "ABSTRACT_SCREENING_MODEL": "gemini-2.5-flash",
    "THE_GATEKEEPER_MODEL": "gemini-2.5-flash",
    "THE_SCIENTIST_MODEL": "gemini-2.5-pro",
    "THE_MINER_MODEL": "gemini-2.5-pro",
    "THE_EXTENDED_MINER_MODEL": "gemini-2.5-pro",
    "TEMPERATURE": "0.0",
    "MAX_TOKENS": "8192",
    "THINKING_LEVEL": "high",
    "THINKING_BUDGET": "-1",
    "SLR_PROTOCOL_DOCUMENT": "",
    "SLR_PAPER": "",
    "BATCH_SIZE": "1",
    "PARALLEL_REQUEST_SIZE": "1",
    "SEARCH_DATE": new Date().toISOString().slice(0, 10),
    "WEB_PROXY_URL": "",
    "RAW_CSV_DATABASE": "",
    "PDF_REPO": "",
    "PDF_METADATA": "",
    "GOLD_MINE": "",
    "MODEL_PRICING": "gemini-2.5-flash-lite,0.1,0.4,1000000\ngemini-3-flash-preview,0.5,3,1000000\ngemini-2.5-pro,1.25,10,1000000",
    "SHOW_OPENING_POPUP": "TRUE",
    "ENABLE_GENERIC_THINKING": "FALSE",
    "OLLAMA_KEEP_ALIVE": "0",
    "OLLAMA_NUM_CTX": "4096"
    // Prompts are handled dynamically to keep file size small if not needed constantly,
    // but for properties we initialize them once.
  };

  /**
   * Gets a configuration value.
   * @param {string} key
   * @returns {string} The value or null if not found.
   */
  function get(key) {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty(key);
  }

  /**
   * Sets a configuration value.
   * @param {string} key
   * @param {string} value
   */
  function set(key, value) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty(key, String(value));
  }

  /**
   * Gets all configuration values as a map.
   * @returns {Object}
   */
  function getAll() {
    return PropertiesService.getScriptProperties().getProperties();
  }

  /**
   * Initializes default values if they don't exist.
   * Also populates prompts.
   */
  function initializeDefaults() {
    const props = PropertiesService.getScriptProperties();
    const existing = props.getProperties();
    const toSet = {};

    // Standard Defaults
    for (const [key, value] of Object.entries(DEFAULTS)) {
      if (!existing[key]) {
        toSet[key] = String(value);
      }
    }

    // Prompts (using helper functions from Setup context, but we need to duplicate them here or import them)
    // Since Setup.js is separate, we'll duplicate the getters here for independence.
    if (!existing["ABSTRACT_SCREENING_PROMPT"]) toSet["ABSTRACT_SCREENING_PROMPT"] = getAbstractScreeningPrompt();
    if (!existing["THE_GATEKEEPER_PROMPT"]) toSet["THE_GATEKEEPER_PROMPT"] = getGatekeeperPrompt();
    if (!existing["THE_SCIENTIST_PROMPT"]) toSet["THE_SCIENTIST_PROMPT"] = getScientistPrompt();
    if (!existing["THE_MINER_PROMPT"]) toSet["THE_MINER_PROMPT"] = getMinerPrompt();
    if (!existing["THE_EXTENDED_MINER_PROMPT"]) toSet["THE_EXTENDED_MINER_PROMPT"] = getExtendedMinerPrompt();
    if (!existing["SEARCH_STRING"]) toSet["SEARCH_STRING"] = getSearchString();

    if (Object.keys(toSet).length > 0) {
      props.setProperties(toSet);
      console.log("[ConfigManager] Initialized default properties.");
    }
  }

  /**
   * Migrates data from 00_manifest sheet if it exists, then deletes the sheet.
   */
  function migrateFromManifest() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = "00_manifest";
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return; // Nothing to migrate
    }

    try {
      console.log("[ConfigManager] Found 00_manifest. Starting migration...");
      const data = sheet.getDataRange().getValues();
      if (data.length < 2) return; // Empty

      const headers = data[0];
      const keyIdx = headers.indexOf('Key');
      const valueIdx = headers.indexOf('Value');

      if (keyIdx === -1 || valueIdx === -1) {
        console.warn("[ConfigManager] 00_manifest missing Key/Value columns. Skipping.");
        return;
      }

      const toSet = {};
      for (let i = 1; i < data.length; i++) {
        const key = data[i][keyIdx];
        const value = data[i][valueIdx];
        if (key) {
          toSet[key] = String(value);
        }
      }

      if (Object.keys(toSet).length > 0) {
        PropertiesService.getScriptProperties().setProperties(toSet);
        console.log(`[ConfigManager] Migrated ${Object.keys(toSet).length} keys.`);
      }

      // Delete the sheet
      ss.deleteSheet(sheet);
      console.log("[ConfigManager] Deleted 00_manifest.");
      SpreadsheetApp.getUi().alert("Configuration migrated from 00_manifest to Script Properties. The sheet has been deleted.");

    } catch (e) {
      console.error("[ConfigManager] Migration failed: " + e.message);
      SpreadsheetApp.getUi().alert("Migration from 00_manifest failed: " + e.message);
    }
  }

  // --- Prompts (Copied from Setup.js for independence) ---
  // To avoid code duplication in the future, we should probably keep them in one place,
  // but for now, to decouple from Setup.js, I will copy them.

  function getAbstractScreeningPrompt() {
    return `Act as a strictly literal, fast-filtering Research Assistant for a Systematic Literature Review. You operate like a highly optimized, sequential logic engine.
--- SEQUENTIAL LOGIC GATES (FAIL-FAST) ---
Evaluate sequentially using a strict [TRIGGERED / CLEAR] binary. 
"TRIGGERED" means the paper violates the criteria and must be excluded. "CLEAR" means it passes that specific check.

[ ] Gate 1: Is the text explicitly a Review, Survey, Bibliometric, Book chapter, or Conference summary? 
    -> If TRIGGERED: Stop. Code = EC1_WrongDocType
[ ] Gate 2: Does the text completely fail to mention a physical asset context, cyber-physical system, or system architecture? 
    -> If TRIGGERED: Stop. Code = EC2_NoSystemContext
[ ] Gate 3: Does the text completely fail to mention an AI/ML forecasting or predictive analytic model? 
    -> If TRIGGERED: Stop. Code = EC3_NoPredictive
[ ] Gate 4 (Architectural vs. Algorithmic Check): 
    CRITICAL RULE: Do NOT exclude a paper simply because it uses "simulation", "synthetic data", or "datasets". 
    EXCLUDE the paper ONLY IF it strictly focuses on pure algorithmic/mathematical performance benchmarking (e.g., solely comparing F1-scores, accuracy on a static dataset) WITHOUT proposing, evaluating, or explicitly discussing a system architecture, framework, or edge-cloud integration.
    -> If TRIGGERED: Stop. Code = EC4_PureAlgorithmic

--- STRICT OUTPUT PROTOCOL ---
1. NO QUOTING REQUIRED: Rely strictly on your internal semantic match.
2. ABORT ON TRIGGER: Stop writing gates the exact moment one evaluates to TRIGGERED.
3. EXACT MAPPING: Ensure the exclusion_code matches the code of the TRIGGERED Gate.

REQUIRED FORMAT:
<think>
G1: [TRIGGERED / CLEAR]
G2: [TRIGGERED / CLEAR]
[... Stop writing immediately if a gate is TRIGGERED ...]
</think>
{
  "decision": "Include" | "Exclude",
  "exclusion_code": "[Insert exact code from triggered Gate, or null]",
  "reasoning": "[Max 50 words. Exclude: State the exact disqualifying trigger. Include: List System, Predictive, and Architectural elements found.]"
}
`;
  }

  function getGatekeeperPrompt() {
    return `--- SYSTEM ROLE & READING PROTOCOL (CRITICAL) ---
Act as a strictly literal Scientific Reviewer for an Information Technology Systematic Literature Review. Your task is to deeply analyze the FULL TEXT to verify the baseline architectural qualifications.

To avoid "hallucinations" over a 10,000+ token context window or citing related work as the author's contribution, you MUST adhere to this reading protocol:
1. IGNORE: Title, Abstract (already screened), Introduction (contains marketing/promises), Literature Review, and Future Work.
2. FOCUS EXCLUSIVELY ON: Methodology / System Architecture / Experimental Setup / Results.
3. THE CONFLICT RULE: If the Introduction claims "AI and Digital Twin" but the Methodology only describes "Static Threshold-based Control", ALWAYS TRUST THE METHODOLOGY.

--- THE 3-PILLAR DIGITAL TWIN ANCHOR ---
To pass, the Methodology/Architecture sections MUST explicitly detail an integrated system comprising:
1. Physical/Cyber-Physical Context: Real deployed hardware/testbeds, OR a rigorously defined distributed architecture/blueprint connecting physical and virtual spaces.
2. Predictive Brain: Data-driven AI/ML/DL models forecasting future states.
3. System Integration: Explicit technical topologies (data pipelines, IoT networks, edge-cloud communication).

--- THE TRAP: REACTIVE AUTOMATION ---
Standard IoT/WSN setups that merely log data to a dashboard, or "Smart" systems relying on hard-coded static thresholds (e.g., "If Humidity < 20%, Turn Pump ON") without adaptive learning are strictly EXCLUDED. This is reactive automation, not predictive intelligence.

--- SEQUENTIAL LOGIC GATES (FAIL-FAST) ---
Evaluate sequentially. "TRIGGERED" means the paper violates the criteria and must be excluded. "CLEAR" means it passes.

[ ] Gate 1 (Accessibility): Is the text not in English, heavily corrupted, garbled OCR, or just a table of contents?
    -> If TRIGGERED: Stop. Code = EC7_Accessibility
[ ] Gate 2 (The Trap / Static Rules): Does the methodology reveal that the control/decision-making system relies ENTIRELY on static, hard-coded rules WITHOUT employing data-driven predictive algorithms?
    -> If TRIGGERED: Stop. Code = EC6_StaticRules
[ ] Gate 3 (Architectural Integrity): Does the text FAIL to comprehensively detail all elements of the 3-Pillar Anchor?
    CRITICAL RULE: Papers proposing reference architectures validated via system simulators (e.g., CloudSim, edge-emulators) are VALID (CLEAR). However, using simulation SOLELY to test algorithmic accuracy (e.g., isolating F1-scores on a static dataset) without defining the underlying cyber-physical integration architecture is INVALID (TRIGGERED).
    -> If TRIGGERED: Stop. Code = EC5_FailedArchitecture

--- STRICT OUTPUT PROTOCOL (JSON PARSER SAFETY) ---
This response will be directly consumed by a serverless JSON.parse() function. Any text outside the <think> block other than valid RFC 8259 JSON will cause a critical pipeline crash.

<think>
G1: [TRIGGERED / CLEAR]
G2: [TRIGGERED / CLEAR]
[... Stop writing immediately if a gate is TRIGGERED ...]
</think>
{
  "decision": "Include" | "Exclude",
  "exclusion_code": "[Insert exact code from triggered Gate, or null]",
  "reasoning": "[Max 50 words. Exclude: State exactly what the METHODOLOGY section lacked. Include: Briefly summarize the physical context, predictive algorithm, and integration pipeline found in the methodology.]"
}
`;
  }

  function getScientistPrompt() {
    return `--- SYSTEM ROLE & READING PROTOCOL ---
Act as an objective, highly rigorous Scientific Reviewer. Your task is to evaluate the scientific rigor and architectural engineering quality of a paper that has already passed baseline relevance checks.
To avoid hallucinations:
1. FOCUS EXCLUSIVELY ON: Methodology, System Architecture, Experimental Setup, and Results sections.
2. IGNORE: Promises made in the Abstract, Introduction, or Future Work.
3. THE EVIDENCE RULE: "No concrete metric or diagram = Score 0". Do not give the benefit of the doubt.

--- THE SCORING ENGINE ---
Evaluate the paper against 8 Quality Assessment (QA) criteria. 
Assign a strict numerical score for each:
[ 1.0 ] = Yes (Fully satisfied with explicit evidence)
[ 0.5 ] = Partially (Satisfied but with limitations or simulated/partial evidence)
[ 0.0 ] = No (Fails to satisfy, vague, or no evidence)

QUALITY CRITERIA:
[ ] QA1_Aims [CRITICAL]: Is there a clear statement of the specific aims regarding the predictive analytics within the system? 
    (1.0: Explicit prediction targets / 0.0: Vague "smart system" claims).
[ ] QA2_Context [CRITICAL]: Are the physical domain, operational scale, and hardware infrastructure precisely defined? 
    (1.0: Specifies exact environment, e.g., "500kW Turbine" or "100m2 Greenhouse" / 0.0: Generic, undefined terms).
[ ] QA3_Reliability [CRITICAL]: Is the data collection and physical-virtual integration reliably executed? 
    (1.0: Uses physical hardware data / 0.5: Simulated but validated with real historical data / 0.0: Pure mathematical concept without physical validation).
[ ] QA4_Architecture [CRITICAL]: Is the computational architecture (Edge, Fog, Cloud) and data pipeline explicitly described or illustrated? 
    (1.0: Clear architectural topology / 0.0: Deployment environment is hidden/omitted).
[ ] QA5_Answered: Do the reported results adequately answer the specific predictive research aims? 
    (1.0: Directly addresses aims / 0.5: Addresses some aims / 0.0: Deviates completely).
[ ] QA6_Limitations: Does the paper explicitly report technical limitations (e.g., computational cost, latency, bandwidth)? 
    (1.0: Discusses technical constraints / 0.5: Mentions non-technical future work / 0.0: Presents a flawless system).
[ ] QA7_Findings [CRITICAL]: Are BOTH predictive accuracy (e.g., RMSE) AND system performance metrics (e.g., network latency, inference time, memory footprint) empirically reported? 
    (1.0: Metrics provided for BOTH model and system / 0.5: ONLY model accuracy reported / 0.0: Qualitative findings only).
[ ] QA8_Conclusion: Do the conclusions explicitly relate back to the aims and are strictly supported by data? 
    (1.0: Grounded in reported numbers / 0.5: Broad claims / 0.0: Overstated, unsupported claims).

--- DECISION LOGIC (THE GATE) ---
A paper is EXCLUDED if it hits EITHER of these two conditions:
1. Critical Failure: It receives a score of [ 0.0 ] on ANY of the [CRITICAL] criteria (QA1, QA2, QA3, QA4, QA7). -> Code = EC8_CriticalFailure
2. Low Quality Threshold: The total sum of QA1 to QA8 is strictly LESS THAN 4.5. -> Code = EC9_LowScoreThreshold

If it passes BOTH rules, it is INCLUDED. -> Code = Pass_Quality

--- STRICT OUTPUT PROTOCOL (JSON PARSER SAFETY) ---
This response will be parsed directly by a serverless JSON.parse() function. Any text outside the <think> block other than valid RFC 8259 JSON will cause a critical crash.

REQUIRED FORMAT:
<think>
Score Calculation:
QA1: [1.0 | 0.5 | 0.0] - Reason...
QA2: [1.0 | 0.5 | 0.0] - Reason...
[... list all up to QA8 ...]
Total Score: [Sum of QA1 to QA8]
Gate Check 1 (Critical 0.0?): [Pass/Fail]
Gate Check 2 (Total >= 4.5?): [Pass/Fail]
</think>
{
  "decision": "Include" | "Exclude",
  "exclusion_code": "EC8_CriticalFailure" | "EC9_LowScoreThreshold" | null,
  "qa_scores": {
    "qa1_aims": { "value": [1.0 | 0.5 | 0.0], "evidence": "[Quote explicit evidence or state None]" },
    "qa2_context": { "value": [1.0 | 0.5 | 0.0], "evidence": "[Quote context/scale/hardware found]" },
    "qa3_reliability": { "value": [1.0 | 0.5 | 0.0], "evidence": "[State data source: Physical / Simulated / None]" },
    "qa4_architecture": { "value": [1.0 | 0.5 | 0.0], "evidence": "[Describe architecture/data pipeline found]" },
    "qa5_answered": { "value": [1.0 | 0.5 | 0.0], "evidence": "[Brief justification]" },
    "qa6_limitations": { "value": [1.0 | 0.5 | 0.0], "evidence": "[Brief justification]" },
    "qa7_findings": { "value": [1.0 | 0.5 | 0.0], "evidence": "[Quote exact metrics, e.g., RMSE / Latency / None]" },
    "qa8_conclusion": { "value": [1.0 | 0.5 | 0.0], "evidence": "[Brief justification]" }
  },
  "reasoning": "[Max 50 words. Provide a highly technical summary justifying the final decision. If excluded, state the critical failure or low total score.]"
}
`;
  }

  function getMinerPrompt() {
    return `--- SYSTEM ROLE & EXTRACTION PROTOCOL ---
Act as a meticulous, zero-hallucination Data Extraction Specialist for a Systematic Literature Review. 
Your input is a full-text scientific paper that has PASSED all relevance and quality checks.
Your SOLE TASK is to extract specific engineering, algorithmic, and architectural parameters strictly mapped to the 4 Research Questions (RQ).

--- PROTOCOL: EXTRACTION RULES (CRITICAL) ---
1. SOURCE OF TRUTH: Focus exclusively on Methodology, System Architecture, Experimental Setup, and Results.
2. EFFORT LEVEL: High. Search figure captions, architectural diagrams, table footnotes, and hardware specs.
3. THE STRICT NULLING RULE: If a data point is TRULY absent, you MUST output "Not Reported" in the "value" field. Do not guess, infer, or assume industry standards.
4. SCALE INFERENCE RULE (Cross-Domain): 
   - Do NOT infer a system is "Small-scale" solely because it uses Raspberry Pi/Arduino; industrial IoT uses MCUs too.
   - Look for context keywords: "Commercial", "Large-scale", "City-wide", "Industrial Plant" (Industrial) VS "Low-cost", "Affordable", "Prototype", "Bench-scale" (Small-scale).
5. MATURITY DEFINITION:
   - Autonomous: AI decides & acts automatically (Closed-loop) without human intervention.
   - Prescriptive: Suggests actions to user (DSS) OR uses static hard-coded rules/thresholds.
   - Predictive: Forecasts future states but does not act or suggest.
   - Monitoring: Dashboard/Visualization only.

--- EXTRACTION FIELDS (JSON) ---

[RQ1.1: DOMAIN & SCALE]
- rq1_primary_domain: The specific industry (e.g., "Aerospace", "Manufacturing", "Smart Horticulture").
- rq1_operational_scale: Extracted scale based on Rule 4 (e.g., "Industrial", "Laboratory Prototype", "Small-scale").
- rq1_maturity_level: Extracted maturity based on Rule 5.

[RQ1.2: ARCHITECTURE]
- rq2_topology: Where does computation happen? (e.g., "Edge-Cloud Distributed", "Monolithic Cloud", "Pure Edge").
- rq2_protocols: Communication/IoT protocols (e.g., "MQTT, LoRaWAN, HTTP").
- rq2_hardware: Explicit hardware/sensor names (e.g., "ESP32, DHT11, NVIDIA Jetson").

[RQ1.3: ALGORITHMS & PERFORMANCE]
- rq3_predictive_models: Exact algorithm names (e.g., "LSTM", "Random Forest").
- rq3_inference_node: Where the model is deployed (e.g., "Deployed on Edge TPU", "Running on AWS Cloud").
- rq3_metrics_model: Predictive accuracy (e.g., "RMSE = 0.05", "98% Accuracy").
- rq3_metrics_system: System performance metrics (e.g., "Inference latency 45ms", "Network delay 12ms").

[RQ1.4: LIMITATIONS]
- rq4_limitations: Explicit technical constraints, bottlenecks, or architectural flaws stated by the authors.

--- STRICT OUTPUT FORMAT (JSON PARSER SAFETY) ---
EVERY field must be an object containing exactly two keys: "value" and "evidence". 
- "value": The extracted concise data OR "Not Reported".
- "evidence": A direct quote or highly specific pointer to where you found it (e.g., "Section 3.2: 'MQTT was used...'").
This response will be parsed directly by a Google Apps Script JSON.parse() function. Any text outside the <think> block other than valid RFC 8259 JSON will cause a critical error.

REQUIRED FORMAT:
<think>
Scanning for RQ1.1 targets...
Scanning for RQ1.2 targets...
Scanning for RQ1.3 targets...
Scanning for RQ1.4 targets...
Validating all fields have 'value' and 'evidence'.
Ensuring nulling rule is applied for missing data.
</think>
{
  "extracted_data": {
    "rq1_primary_domain": { "value": "...", "evidence": "..." },
    "rq1_operational_scale": { "value": "...", "evidence": "..." },
    "rq1_maturity_level": { "value": "...", "evidence": "..." },
    "rq2_topology": { "value": "...", "evidence": "..." },
    "rq2_protocols": { "value": "...", "evidence": "..." },
    "rq2_hardware": { "value": "...", "evidence": "..." },
    "rq3_predictive_models": { "value": "...", "evidence": "..." },
    "rq3_inference_node": { "value": "...", "evidence": "..." },
    "rq3_metrics_model": { "value": "...", "evidence": "..." },
    "rq3_metrics_system": { "value": "...", "evidence": "..." },
    "rq4_limitations": { "value": "...", "evidence": "..." }
  }
}
`;
  }

  function getExtendedMinerPrompt() {
    return `--- SYSTEM ROLE & EXTRACTION PROTOCOL ---
Act as a meticulous, zero-hallucination Data Extraction Specialist for a Systematic Literature Review. 
Your input is a full-text scientific paper that has PASSED all relevance and quality checks.
Your SOLE TASK is to extract specific engineering, algorithmic, and architectural parameters strictly mapped to the 4 Research Questions (RQ).

--- PROTOCOL: EXTRACTION RULES (CRITICAL) ---
1. SOURCE OF TRUTH: Focus exclusively on Methodology, System Architecture, Experimental Setup, and Results.
2. EFFORT LEVEL: High. Search figure captions, architectural diagrams, table footnotes, and hardware specs.
3. THE STRICT NULLING RULE: If a data point is TRULY absent, you MUST output "Not Reported" in the "value" field. Do not guess, infer, or assume industry standards.
4. SCALE INFERENCE RULE (Cross-Domain): 
   - Do NOT infer a system is "Small-scale" solely because it uses Raspberry Pi/Arduino; industrial IoT uses MCUs too.
   - Look for context keywords: "Commercial", "Large-scale", "City-wide", "Industrial Plant" (Industrial) VS "Low-cost", "Affordable", "Prototype", "Bench-scale" (Small-scale).
5. MATURITY DEFINITION:
   - Autonomous: AI decides & acts automatically (Closed-loop) without human intervention.
   - Prescriptive: Suggests actions to user (DSS) OR uses static hard-coded rules/thresholds.
   - Predictive: Forecasts future states but does not act or suggest.
   - Monitoring: Dashboard/Visualization only.

--- EXTRACTION FIELDS (JSON) ---

[RQ1.1: DOMAIN & SCALE]
- rq1_primary_domain: The specific industry (e.g., "Aerospace", "Manufacturing", "Smart Horticulture").
- rq1_operational_scale: Extracted scale based on Rule 4 (e.g., "Industrial", "Laboratory Prototype", "Small-scale").
- rq1_maturity_level: Extracted maturity based on Rule 5.

[RQ1.2: ARCHITECTURE]
- rq2_topology: Where does computation happen? (e.g., "Edge-Cloud Distributed", "Monolithic Cloud", "Pure Edge").
- rq2_protocols: Communication/IoT protocols (e.g., "MQTT, LoRaWAN, HTTP").
- rq2_hardware: Explicit hardware/sensor names (e.g., "ESP32, DHT11, NVIDIA Jetson").

[RQ1.3: ALGORITHMS & PERFORMANCE]
- rq3_predictive_models: Exact algorithm names (e.g., "LSTM", "Random Forest").
- rq3_inference_node: Where the model is deployed (e.g., "Deployed on Edge TPU", "Running on AWS Cloud").
- rq3_metrics_model: Predictive accuracy (e.g., "RMSE = 0.05", "98% Accuracy").
- rq3_metrics_system: System performance metrics (e.g., "Inference latency 45ms", "Network delay 12ms").

[RQ1.4: LIMITATIONS]
- rq4_limitations: Explicit technical constraints, bottlenecks, or architectural flaws stated by the authors.

--- STRICT OUTPUT FORMAT (JSON PARSER SAFETY) ---
EVERY field must be an object containing exactly two keys: "value" and "evidence". 
- "value": The extracted concise data OR "Not Reported".
- "evidence": A direct quote or highly specific pointer to where you found it (e.g., "Section 3.2: 'MQTT was used...'").
This response will be parsed directly by a Google Apps Script JSON.parse() function. Any text outside the <think> block other than valid RFC 8259 JSON will cause a critical error.

REQUIRED FORMAT:
<think>
Scanning for RQ1.1 targets...
Scanning for RQ1.2 targets...
Scanning for RQ1.3 targets...
Scanning for RQ1.4 targets...
Validating all fields have 'value' and 'evidence'.
Ensuring nulling rule is applied for missing data.
</think>
{
  "extracted_data": {
    "rq1_primary_domain": { "value": "...", "evidence": "..." },
    "rq1_operational_scale": { "value": "...", "evidence": "..." },
    "rq1_maturity_level": { "value": "...", "evidence": "..." },
    "rq2_topology": { "value": "...", "evidence": "..." },
    "rq2_protocols": { "value": "...", "evidence": "..." },
    "rq2_hardware": { "value": "...", "evidence": "..." },
    "rq3_predictive_models": { "value": "...", "evidence": "..." },
    "rq3_inference_node": { "value": "...", "evidence": "..." },
    "rq3_metrics_model": { "value": "...", "evidence": "..." },
    "rq3_metrics_system": { "value": "...", "evidence": "..." },
    "rq4_limitations": { "value": "...", "evidence": "..." }
  }
}
`;
  }

  function getSearchString() {
    return `TITLE-ABS-KEY ( "digital twin*" OR "digital-twin*" )
AND
TITLE-ABS-KEY ( "predictive analytic*" OR "machine learning" OR "deep learning" OR "forecasting" OR "prognostic*" )
AND
TITLE-ABS-KEY ( "architecture*" OR "cyber-physical" OR "edge computing" OR "fog computing" OR "system-of-systems" OR "framework" )
AND NOT
TITLE-ABS-KEY ( "genomic*" OR "molecular docking" OR "surgery" OR "patient*" OR "nanomaterial*" OR "pharmac*" OR "clinical" )
AND
( LIMIT-TO ( PUBYEAR, 2025 ) OR LIMIT-TO ( PUBYEAR, 2024 ) OR LIMIT-TO ( PUBYEAR, 2023 ) OR LIMIT-TO ( PUBYEAR, 2022 ) OR LIMIT-TO ( PUBYEAR, 2021 ) OR LIMIT-TO ( PUBYEAR, 2020 ) OR LIMIT-TO ( PUBYEAR, 2019 ) OR LIMIT-TO ( PUBYEAR, 2018 ) )
`;
  }

  return {
    get,
    set,
    getAll,
    initializeDefaults,
    migrateFromManifest
  };

})();
