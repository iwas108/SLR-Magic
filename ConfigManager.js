/**
 * ConfigManager.js
 * Manages configuration using Script Properties instead of a sheet.
 * Includes migration logic from legacy 00_manifest.
 */

const ConfigManager = (function() {

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
    return `"Act as a strict Senior Editor conducting the first-pass screening for a Systematic Literature Review (SLR).

YOUR CONTEXT:
PhD Topic: ""Digital Twin-Based Smart Prediction Analytics for Small-scale Precision Horticulture"".

YOUR TASK:
Analyze the provided ""Title"" and ""Abstract"" to determine relevance based on strict logic gates.
Return ONLY a valid JSON object.

--- LOGIC GATES (Execute in Order) ---

1. PRE-SCREENING (Context Check):
   - The paper MUST be about **Horticulture** (Greenhouse, Hydroponics, Vertical Farm, or specific crops like Tomato, Chili, Cucumber, Flowers).
   - EXCLUDE immediately if context is:
     * Field Crops (Rice, Wheat, Corn, Soybean, Sugarcane).
     * Forestry, Livestock, Fishery/Aquaculture.
     * Post-harvest processing, Supply Chain, or Food Science (unless related to pre-harvest prediction).
     * Energy Generation (Solar panels, Biofuel, P2G) or Waste Management (MSW).

2. INTELLIGENCE CHECK (The ""Digital Twin"" Core):
   - The system MUST involve **IT/Software Intelligence** (Digital Twin, IoT, AI, Edge Computing).
   - **CRITICAL DISTINCTION (The ""PlaneSegNet"" Trap):**
     * **INCLUDE:** AI used for *Cognition/Decision*: Prediction (Yield/Growth), Forecasting (Climate), Simulation (What-if), Optimization (Resources), or Closed-loop Control.
     * **EXCLUDE:** AI used for *Pure Perception* only: Image segmentation, Leaf disease detection, or Counting, WITHOUT linking it to a prediction model, growth analysis, or control action. (Data processing is not Analytics).
     * **EXCLUDE:** Passive Monitoring: ""IoT dashboard that just shows graphs"" (No decision support).

3. EXCLUSION CODES (Assign specific code):
   - **E101_WrongContext:** Field crops, Livestock, Energy, Waste, or purely mechanical robotics (designing a gripper) without smart control logic.
   - **E102_NonTech:** Pure Agronomy/Biology (Genetics, nutrient formulas) with no sensor/software contribution.
   - **E103_NoIntelligence:** Passive monitoring (Data logging only), Simple Automation (Threshold-based), or **Pure Computer Vision** (Segmentation/Detection only) with no predictive/control output.
   - **E104_WrongType:** Review Papers, Surveys, Books, Conference Summaries.

4. SCALE TAGGING (If Included):
   - **Small-scale:** Explicit mentions of ""Low-cost"", ""Affordable"", ""Raspberry Pi"", ""Arduino"", ""ESP32"", ""DIY"", ""Smallholder"", ""Family farm"", or ""Developing countries"".
   - **Industrial/Commercial:** Mentions of ""Plant Factory"", ""Large-scale"", ""High-throughput"", ""Commercial Greenhouse"", ""Robot Swarms"", or complex expensive infrastructure.
   - **General/Unspecified:** If the scale is not explicitly defined.

--- OUTPUT FORMAT (JSON) ---
This response will be parsed directly by a Google Apps Script JSON.parse() function. Any text other than valid JSON will cause a critical error. Strict adherence to RFC 8259 is required:
{
  ""decision"": ""Include"" OR ""Exclude"",
  ""exclusion_code"": ""E101_WrongContext"" OR ""E102_NonTech"" OR ""E103_NoIntelligence"" OR ""E104_WrongType"" OR null,
  ""scale_tag"": ""Small-scale"" OR ""Industrial/Commercial"" OR ""General/Unspecified"" OR null,
  ""reasoning"": ""Max 150 words. If Excluded E103, specify if it was 'Passive Monitoring' or 'Pure Perception'. If Included, state the specific 'Intelligence' found (e.g., Yield Prediction, Climate Control) in the reasoning.""
}"`;
  }

  function getGatekeeperPrompt() {
    return `"Act as a strict Scientific Reviewer conducting the STAGE 1 (RELEVANCE FILTER) for a PhD Systematic Literature Review.
Context: ""Digital Twin-Based Smart Prediction Analytics for Small-scale Precision Horticulture"".

YOUR SOLE TASK:
Read the provided FULL TEXT and determine if this paper should be INCLUDED or EXCLUDED based on strict technical capability definitions.
Do not extract data yet. Focus only on the Go/No-Go decision.

--- PROTOCOL: READING SCOPE (CRITICAL) ---
To avoid ""hallucinations"" or citing related work as the author's contribution, you must adhere to this reading protocol:
1. **IGNORE:** Title, Abstract (already screened), Introduction (contains ""promises"" or general context), Literature Review / Related Work (describes *other* people's work), and Future Work.
2. **FOCUS EXCLUSIVELY ON:**
   - **Methodology / Materials & Methods:** To verify the actual algorithms and control logic implemented.
   - **System Architecture / System Design:** To verify the hardware/software layers.
   - **Results / Evaluation:** To verify valid data and actual performance.
3. **CONFLICT RULE:** If the Introduction mentions ""AI/Digital Twin"" but the Methodology only describes ""Threshold-based control"", TRUST THE METHODOLOGY.

--- DEFINITIONS: THE SOURCE OF TRUTH ---

1. TARGET: TRUE DIGITAL TWIN / SMART ANALYTICS
   - Must involve a **Computational Model** (AI/Physics-based) that mirrors the physical system.
   - Must link **""Perception""** (Sensors) to **""Cognition""** (Prediction/Simulation).
   - **Key Capability:** The system acts based on **Future States** (Prediction) or **What-If Scenarios** (Simulation).
   - *Example:* ""Model predicts fungal infection in 2 days -> System preemptively adjusts humidity.""

2. TRAP: STANDARD IOT / WSN / AUTOMATION (EXCLUDE)
   - **Characteristics:**
     - Wireless Sensor Networks (WSN) that simply log data to a cloud/dashboard.
     - ""Smart Irrigation"" that relies on **Static Thresholds** (e.g., ""If Soil Moisture < 20%, Turn Pump ON"").
     - ""Model-based"" studies where the model is only used for manual validation or offline analysis, NOT for real-time control loop.
   - **Why Exclude:** This is ""Reactive Automation"", not ""Cognitive Digital Twin Intelligence"".

--- LOGIC GATES (CHECK IN ORDER) ---

1. GATE 0: LANGUAGE & INTEGRITY
   - **EXCLUDE (E203_Language_Error):**
     - Full text is NOT in English (e.g., Chinese, Spanish, etc.).
     - File is corrupted, unreadable, mostly images without OCR, or contains only gibberish text.
     - Content is just a placeholder, table of contents, or access denied page.

2. GATE 1: CONTEXT SCOPE
   - **EXCLUDE (E201_WrongContext):**
     - Field Crops (Rice, Corn, Wheat, Soybean), Livestock, Fishery, Forestry.
     - Energy Generation (Solar/Wind focus), Supply Chain, Post-Harvest, or Robotics Mechanics (designing grippers only).
   - **INCLUDE:** Greenhouse, Vertical Farm, Hydroponics, Plant Factory, or specific horticultural crops (Tomato, Chili, etc.).

3. GATE 2: INTELLIGENCE LEVEL (THE ""KILLER"" FILTER)
   - **EXCLUDE (E205_TechMismatch):**
     - **Passive Monitoring:** Dashboard/App for data visualization only.
     - **Simple Automation:** Control logic is purely Rule-based/Threshold (If-Then). No learning/adaptive capability.
     - **Pure Perception:** AI used ONLY for Computer Vision (Segmentation/Counting) without linking to a prediction/control loop.

4. GATE 3: VALIDATION & QUALITY
   - **EXCLUDE (E202_NoValidation):** Pure simulation (Matlab/Simulink) with NO real-world data or physical prototype.
   - **EXCLUDE (E204_LowQuality):** No quantitative results, confusing methodology, or not a research paper.

--- OUTPUT FORMAT (JSON) ---
This response will be parsed directly by a Google Apps Script JSON.parse() function. Any text other than valid JSON will cause a critical error. Strict adherence to RFC 8259 is required:
{
  ""decision"": ""Include"" OR ""Exclude"",
  ""exclusion_code"": ""E201_WrongContext"" OR ""E202_NoValidation"" OR ""E203_Language_Error"" OR ""E204_LowQuality"" OR ""E205_TechMismatch"" OR null,
  ""reasoning"": ""Strict explanation (max 150 words). State clearly what was found in the METHODOLOGY section. IF E205, explicitly state: 'Methodology describes [Threshold/WSN/Passive] logic, lacking predictive analytics or adaptive control'.""
}"`;
  }

  function getScientistPrompt() {
    return `"Act as a strict Scientific Reviewer conducting the STAGE 2 (QUALITY ASSESSMENT) for a PhD Systematic Literature Review.
Context: ""Digital Twin-Based Smart Prediction Analytics for Small-scale Precision Horticulture"".

YOUR INPUT:
A research paper that has ALREADY PASSED the relevance filter.

YOUR SOLE TASK:
Evaluate the **Scientific Rigor** and **Completeness of Documentation**.
You are the ""Quality Gatekeeper"". Do not let vague papers pass.

--- PROTOCOL: READING SCOPE ---
1. **FOCUS:** Methodology, System Architecture, Experimental Setup.
2. **IGNORE:** Abstract promises. Look for explicit descriptions in the text/diagrams.
3. **MINDSET:** ""No Diagram/Architecture = No Digital Twin"". Be harsh on vague descriptions.

--- QUALITY CRITERIA (Rate each: ""Yes"", ""Partial"", ""No"") ---

1. **QA1_Aims:** Is there a clear statement of the research goal?
2. **QA2_Context:** Is the operational scale and crop context clearly defined?
   - *YES:* Explicitly mentions ""Commercial Greenhouse"", ""Small-scale prototype"", or ""Laboratory setup"".
   - *NO:* Vague terms like ""Agricultural environment"" without specifics.
3. **QA3_System_Validity (CRITICAL):** Is the Digital Twin/IoT system actually built and valid?
   - *YES:* Describes specific sensors, controllers, and data flow.
   - *NO:* Conceptual framework only, or ""we propose a system"" without implementation.
4. **QA4_Architecture_Doc (CRITICAL):** Is the IT/System Architecture clearly described or illustrated?
   - *YES:* Explains the **Data Flow** (Physical -> Cloud/Model -> User). Mentions specific platforms (e.g., ""MQTT to AWS"", ""Raspberry Pi to Local Dashboard"").
   - *NO:* No architecture diagram, no mention of how data is processed or visualized. **(Automatic Fail for DT papers).**
5. **QA5_Answered:** Do the results answer the aims?
6. **QA6_Negative:** Does it report limitations?
7. **QA7_Quantitative_Results (CRITICAL):** Are there hard numbers?
   - *YES:* RMSE, Accuracy, Latency (ms), Yield (kg), Water Savings (%).
   - *NO:* Only ""The system works well"" or qualitative observations.
8. **QA8_Conclusion:** Supported by data?

--- DECISION LOGIC (THE QUALITY THRESHOLD) ---

- **EXCLUDE (Code: E204_LowQuality):**
  - IF **QA3_System_Validity** is ""No"".
  - OR IF **QA4_Architecture_Doc** is ""No"" (Missing Architecture/Data Flow).
  - OR IF **QA4_Architecture_Doc** is ""Partial"" AND **QA3_System_Validity** is ""Partial"" (Double weakness).
  - OR IF **QA7_Quantitative_Results** is ""No"".
  - OR IF there are more than 2 ""No"" ratings in total.

- **PROCEED (Code: Pass_Quality):**
  - Only if the paper describes a **Real, Documented System** with **Results**.

--- OUTPUT FORMAT (JSON) ---
This response will be parsed directly by a Google Apps Script JSON.parse() function. Any text other than valid JSON will cause a critical error. Strict adherence to RFC 8259 is required:
{
  ""decision"": ""Include"" OR ""Exclude"",
  ""exclusion_code"": ""E204_LowQuality"" OR null,
  ""qa_scores"": {
    ""qa1_aims"": { ""value"": ""Yes/Partial/No"", ""evidence"": ""..."" },
    ""qa2_context"": { ""value"": ""Yes/Partial/No"", ""evidence"": ""..."" },
    ""qa3_system_validity"": { ""value"": ""Yes/Partial/No"", ""evidence"": ""..."" },
    ""qa4_architecture_doc"": { ""value"": ""Yes/Partial/No"", ""evidence"": ""State if architecture diagram/flow is present."" },
    ""qa5_answered"": { ""value"": ""Yes/Partial/No"", ""evidence"": ""..."" },
    ""qa6_negative"": { ""value"": ""Yes/Partial/No"", ""evidence"": ""..."" },
    ""qa7_quantitative_results"": { ""value"": ""Yes/Partial/No"", ""evidence"": ""Quote key metrics found."" },
    ""qa8_conclusion"": { ""value"": ""Yes/Partial/No"", ""evidence"": ""..."" }
  },
  ""reasoning"": ""Brief summary (max 150 words). If Excluded, explicitly state: 'Missing Architecture Details', 'No Quantitative Data', or 'Vague System Design'.""
}"`;
  }

  function getMinerPrompt() {
    return `"Act as a meticulous Data Extraction Specialist for a PhD Systematic Literature Review.
Context: ""Digital Twin-Based Smart Prediction Analytics for Small-scale Precision Horticulture"".

YOUR INPUT:
A research paper that has PASSED all relevance and quality checks.
Your job is NOT to judge the paper, but to **EXTRACT** specific data points with forensic precision.

--- PROTOCOL: EXTRACTION RULES ---
1. **SOURCE OF TRUTH:** Focus on **Methodology**, **System Architecture**, and **Results**.
2. **EFFORT LEVEL:** High. Do not be lazy. Search figure captions, table footnotes, and hardware specs.
3. **HANDLING ""UNSPECIFIED"":**
   - Only return ""Unspecified"" if the information is TRULY absent after a deep search.
   - If the text implies a specific technology (e.g., ""802.11"" -> ""WiFi""), extract the standardized name.
4. **SCALE INFERENCE RULE (CRITICAL):**
   - Do NOT infer ""Small-scale"" solely because they use Arduino/STM32. Industrial systems use MCUs too.
   - Look for context keywords: ""Commercial"", ""Large-scale"", ""Hectares"" (Industrial) VS ""Low-cost"", ""Affordable"", ""Smallholder"", ""Backyard"", ""Prototype"" (Small-scale).
5. **MATURITY RULE:**
   - Adhere to the strict ""Autonomous"" definition. No manual approval, no simple timer/threshold.

--- EXTRACTION FIELDS (JSON) ---

[METADATA]
0. **meta_country**: Country of the First Author's affiliation? (Clean name, e.g., ""Netherlands"").

[RQ1: CONTEXT & MATURITY]
1. **rq1a_crop**: Specific crop tested? (e.g., ""Tomato"", ""Lettuce""). If general, write ""Generic Horticulture"".
2. **rq1b_scale**: Target Scale?
   - Options: [Small-scale (Low-cost/Smallholder/DIY), Industrial (Commercial/High-tech/Large), Laboratory_Prototype (Generic/Bench-scale), Unspecified].
3. **rq1c_maturity**: Highest Control Level?
   - **Autonomous:** System uses a Dynamic Model/AI to decide & act automatically (Closed-loop). *Note: Simple Threshold (If < 30% then On) is PRESCRIPTIVE, not Autonomous.*
   - **Prescriptive:** Suggests actions to user (DSS) OR uses static automation rules/thresholds.
   - **Predictive:** Forecasts future states (e.g., Yield) but does not act.
   - **Monitoring:** Dashboard/Viz only.

[RQ2: ARCHITECTURE]
4. **rq2a_platform**: Hardware Layers? (List ALL that apply).
   - Options: [Cloud_Server, Edge_SBC, MCU, PLC (Industrial), PC_Workstation, Mobile_Device].
5. **rq2b_connectivity**: Physical Protocols? (List ALL that apply).
   - Options: [WiFi, LoRa/LoRaWAN, Zigbee, Bluetooth/BLE, 4G/5G/LTE, NB-IoT, Ethernet, RS485/Modbus, CAN_Bus, Not Reported].

[RQ3: INTELLIGENCE CORE]
6. **rq3a_ai_category**: Intelligence Type? (List ALL that apply).
   - Options: [Deep_Learning, Traditional_ML, Hybrid_Physics_AI, Simulation_Model, Fuzzy_Logic, Rule_Based].
7. **rq3b_algorithm**: Specific Algorithm Names?
   - Examples: ""LSTM"", ""CNN"", ""Random Forest"", ""Penman-Monteith"", ""MPC"".
8. **rq3c_target**: What is being Predicted/Optimized? (List ALL that apply).
   - Options: [Yield/Growth, Water/Nutrient, Climate/Energy, Disease/Pest, Labor/Cost, System_Health].

[RQ4: INTERFACE & RESULTS]
9. **rq4a_metric**: Best quantitative performance result?
   - Example: ""95% Accuracy"", ""RMSE 0.2"", ""40% Water Saving"". Quote the number.
10. **rq4b_interface**: User Interface Type?
    - Options: [Dashboard_2D, 3D_Digital_Shadow (Must use 3D/WebGL/Virtual Entity), Mobile_App, VR/AR, Local_HMI_Screen, Chatbot/NLP/LLM, None].

--- OUTPUT FORMAT (JSON) ---
EVERY field must be an object with ""value"" and ""evidence"".
This response will be parsed directly by a Google Apps Script JSON.parse() function. Any text other than valid JSON will cause a critical error. Strict adherence to RFC 8259 is required:
Example:
{
  ""extracted_data"": {
    ""meta_country"": { ""value"": ""Netherlands"", ""evidence"": ""Page 1: Wageningen University..."" },
    ""rq1a_crop"": { ""value"": ""Tomato"", ""evidence"": ""Page 3: 'Experiment conducted on Solanum lycopersicum...'"" },
    ""rq1b_scale"": { ""value"": ""Small-scale"", ""evidence"": ""Page 1: 'Proposed a low-cost system for smallholder farmers...'"" },
    ""rq1c_maturity"": { ""value"": ""Prescriptive"", ""evidence"": ""Page 5: 'System suggests irrigation schedule based on predictions...'"" },
    ""rq2a_platform"": { ""value"": ""MCU, Cloud_Server"", ""evidence"": ""Page 4: 'ESP32 sends data to AWS Cloud...'"" },
    ""rq2b_connectivity"": { ""value"": ""WiFi"", ""evidence"": ""Page 4: '...via MQTT over WiFi network.'"" },
    ""rq3a_ai_category"": { ""value"": ""Deep_Learning"", ""evidence"": ""Page 2: 'Used LSTM network...'"" },
    ""rq3b_algorithm"": { ""value"": ""LSTM"", ""evidence"": ""Page 2: 'Used LSTM network...'"" },
    ""rq3c_target"": { ""value"": ""Water/Nutrient"", ""evidence"": ""Page 1: 'optimize water usage...'"" },
    ""rq4a_metric"": { ""value"": ""RMSE 0.05"", ""evidence"": ""Table 2: 'Soil moisture RMSE was 0.05...'"" },
    ""rq4b_interface"": { ""value"": ""Dashboard_2D"", ""evidence"": ""Fig 5 shows a web dashboard."" }
  }
}"`;
  }

  function getExtendedMinerPrompt() {
    return `"Act as a Domain Expert and Senior Software Architect for a Systematic Literature Review.
Study Topic: ""Democratizing the Digital Twin: Architectures and Predictive Analytics for Small-scale Horticulture"".

YOUR INPUT:
The Full Text of a research paper.

YOUR TASK:
Scan the Methodology, System Design, Results, and Discussion sections to extract SPECIFIC technical and qualitative data points (RQ2, RQ3, RQ5, RQ6, RQ7).

--- EXTRACTION RULES ---
1. **Format**: Return a single valid JSON object.
2. **Structure**: All keys must be inside ""extracted_data"".
3. **Fields**: Every key must have ""value"" (the answer) and ""evidence"" (short quote/location in text).
4. **Accuracy**: Do not hallucinate. If info is missing, set value to ""Unspecified"" or ""None_Reported"".
5. **Separator**: For all lists, use a Comma (,) as the strict separator.

--- EXTRACTION FIELDS ---

// --- SOFTWARE & ARCHITECTURE (OPEN EXTRACTION) ---

1. **rq2c_software_platforms**:
   - List ALL Middleware, IoT Platforms, Cloud Providers, or Database Systems used.
   - **Open Extraction**: Extract whatever is named.
   - **Examples**: ""ThingsBoard, Blynk, AWS IoT, Firebase, Docker, Kubernetes, MySQL, InfluxDB, Node-RED"".
   - If built from scratch using basic web tech, write ""Custom_Web_Stack"".

2. **rq2d_arch_patterns**:
   - Does the paper explicitly cite a Reference Architecture or Design Pattern?
   - **Priority 1 (Industrial)**: Look for ""5C CPS"", ""RAMI 4.0"", ""IIRA"", ""ISA-95"", ""IoT-A"".
   - **Priority 2 (Software)**: Look for ""Layered Architecture"", ""SOA"", ""Microservices"", ""MVC"", ""Broker Pattern"", ""Master-Slave"".
   - If no specific pattern is named but layers are described, write ""Layered_Architecture"".

3. **rq3d_dev_stack**:
   - List Programming Languages, AI Frameworks, and Libraries.
   - **Open Extraction**: Extract exact names.
   - **Examples**: ""Python, C++, TensorFlow, PyTorch, Scikit-learn, Pandas, TensorFlow Lite, Edge Impulse, Llama, Qwen"".

// --- BARRIERS & LIMITATIONS ---

4. **rq5a_challenge_category**:
   - Primary barrier or limitation reported?
   - Select ONE or MORE from: [Cost/Economic, Connectivity/Network, Hardware_Reliability, Model_Data_Issues, Skill_Gap/Adoption, Computational_Limit, None_Reported].
   - **Constraint**: Return a comma-separated string if multiple apply.

5. **rq5b_challenge_description**:
   - Extract a DECLARATIVE statement summarizing the specific complaint/limitation.
   - Example: ""The dependency on stable 4G connection caused data loss.""
   - If None_Reported, value is ""No explicit limitations mentioned.""

// --- PHYSICAL INTERFACE ---

6. **rq6a_sensors**:
   - List the specific physical parameters measured.
   - **Constraint**: Use Standardized Naming (e.g., ""Air Temperature"" not ""Temp"", ""Soil Moisture"", ""pH"", ""EC"").

7. **rq6b_actuators**:
   - List the specific hardware actuators controlled.
   - **Constraint**: List the Hardware, not the action (e.g., ""Water Pump"", ""Heater"", ""Window Motor"", ""Grow Lights"").
   - If advisory only, value is ""None (Advisory Only)"".

// --- DEMOCRATIZATION ---

8. **rq7a_cost_reported**:
   - Does the paper mention the specific cost?
   - **Constraint**: Include CURRENCY symbol.
   - Format Options: ""No"", ""Yes: $150"" (or other currency), ""Yes: Low-cost (unspecified)"".

9. **rq7b_data_availability**:
   - Is the code/data available?
   - Select EXACTLY ONE from:
     - ""Public_Open_Source"" (If GitHub/Zenodo/Drive link exists)
     - ""Available_Upon_Request"" (If authors state availability on request)
     - ""Proprietary_Closed"" (If not mentioned or explicitly closed)

--- OUTPUT FORMAT (JSON) ---
Return ONLY a single valid JSON object. Do not include markdown formatting.

{
  ""extracted_data"": {
    ""rq2c_software_platforms"": {
      ""value"": ""ThingsBoard, AWS IoT, PostgreSQL"",
      ""evidence"": ""System Architecture section mentions ThingsBoard for visualization and AWS for storage.""
    },
    ""rq2d_arch_patterns"": {
      ""value"": ""Layered_Architecture, MVC"",
      ""evidence"": ""Section 3 describes a 3-layer architecture implementing MVC pattern.""
    },
    ""rq3d_dev_stack"": {
      ""value"": ""Python, TensorFlow Lite, NumPy"",
      ""evidence"": ""Model training used Python and TFLite for deployment.""
    },
    ""rq5a_challenge_category"": {
      ""value"": ""Connectivity/Network, Computational_Limit"",
      ""evidence"": ""Discussion: intermittent signal and Raspberry Pi overheating.""
    },
    ""rq5b_challenge_description"": {
      ""value"": ""The edge device struggled to run the full model, causing overheating, and rural 4G was unstable."",
      ""evidence"": ""Section 5 Limitations.""
    },
    ""rq6a_sensors"": {
      ""value"": ""Air Temperature, Humidity, Soil Moisture, pH"",
      ""evidence"": ""Methodology: DHT22, capacitive soil sensor, pH probe.""
    },
    ""rq6b_actuators"": {
      ""value"": ""Water Pump, Ventilation Fan"",
      ""evidence"": ""Fig 3 shows relay connections.""
    },
    ""rq7a_cost_reported"": {
      ""value"": ""Yes: $120"",
      ""evidence"": ""Conclusion: Total prototype cost is approx $120.""
    },
    ""rq7b_data_availability"": {
      ""value"": ""Public_Open_Source"",
      ""evidence"": ""GitHub link provided in footnote 3.""
    }
  }
}"`;
  }

  function getSearchString() {
    return `"TITLE-ABS-KEY (
  ( ""Greenhouse*"" OR ""Glasshouse*"" OR ""Polyhouse*"" OR ""Net house*"" OR ""Screen house*"" OR ""Protected cultivation"" OR ""Controlled environment agriculture"" OR ""Vertical farm*"" OR ""Plant factory"" OR ""Indoor farm*"" )
  AND
  ( ""Horticulture"" OR ""Crop*"" OR ""Plant*"" OR ""Vegetable*"" OR ""Fruit*"" OR ""Flower*"" OR ""Ornamental*"" OR ""Tomato*"" OR ""Pepper*"" OR ""Cucumber*"" OR ""Melon*"" OR ""Strawberry*"" OR ""Lettuce*"" )
  AND
  ( ""Digital Twin*"" OR ""Cyber-Physical System*"" OR ""CPS"" OR ""Decision Support System*"" OR ""DSS"" OR ""Internet of Things"" OR ""IoT"" OR ""Edge Computing"" OR ""TinyML"" OR ""AIoT"" OR ""Smart farm*"" OR ""Smart agricultur*"" )
  AND
  ( ""Predict*"" OR ""Forecast*"" OR ""Simulat*"" OR ""Artificial Intelligence"" OR ""Machine Learning"" OR ""Deep Learning"" OR ""Computer Vision"" OR ""Neural Network*"" OR ""Model-based control"" OR ""Optimization"" OR ""Data-driven"" )
)
AND NOT TITLE-ABS-KEY (
  ""Greenhouse gas"" OR ""Carbon emission*"" OR ""Livestock"" OR ""Animal"" OR ""Dairy"" OR ""Fish"" OR ""Aquaculture""
  OR ""Wheat"" OR ""Maize"" OR ""Rice"" OR ""Soybean"" OR ""Cotton"" OR ""Sugarcane"" OR ""Oil palm""
  OR ""Heavy metal*"" OR ""Arsenic"" OR ""Soil contamination"" OR ""Wastewater"" OR ""Sewage""
  OR ""Tissue culture"" OR ""In vitro"" OR ""Callus"" OR ""Biostimulant*"" OR ""Genomic*"" OR ""Metabolomics""
  OR ""Satellite*"" OR ""Land use"" OR ""Land cover""
  OR ""Power plant"" OR ""Desalination"" OR ""Hydrogen"" OR ""Carbon capture"" OR ""Biogas"" OR ""Biofuel""
  OR ""Fabrication"" OR ""Synthesis"" OR ""Nanomaterial*"" OR ""Graphene"" OR ""Polymer"" OR ""Electrode""
)
AND ( LIMIT-TO ( DOCTYPE, ""ar"" ) OR LIMIT-TO ( DOCTYPE, ""cp"" ) )
AND ( LIMIT-TO ( PUBYEAR, 2025 ) OR LIMIT-TO ( PUBYEAR, 2024 ) OR LIMIT-TO ( PUBYEAR, 2023 ) OR LIMIT-TO ( PUBYEAR, 2022 ) OR LIMIT-TO ( PUBYEAR, 2021 ) OR LIMIT-TO ( PUBYEAR, 2020 ) OR LIMIT-TO ( PUBYEAR, 2019 ) OR LIMIT-TO ( PUBYEAR, 2018 ) OR LIMIT-TO ( PUBYEAR, 2017 ) OR LIMIT-TO ( PUBYEAR, 2016 ) )
AND ( LIMIT-TO ( LANGUAGE, ""English"" ) )"`;
  }

  return {
    get,
    set,
    getAll,
    initializeDefaults,
    migrateFromManifest
  };

})();
