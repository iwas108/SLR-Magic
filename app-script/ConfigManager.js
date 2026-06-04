/**
 * ConfigManager.js
 * Manages configuration using Document Properties instead of Script Properties
 * to support multi-user/multi-document separation and Clean Architecture.
 */

const ConfigManager = (function () {

  const DEFAULTS = {
    "PROJECT_NAME": "SLR Magic Review",
    "RESEARCH_MANIFESTO": "",
    "RESEARCH_OBJECTIVE": "",
    "RESEARCH_QUESTIONS": "",
    "QUALITY_ASSURANCE_DEFINITION": "",
    "EXCLUSION_CRITERIA": ""
  };

  /**
   * Gets a configuration value from Document Properties.
   * @param {string} key
   * @returns {string} The value or null if not found.
   */
  function get(key) {
    const props = PropertiesService.getDocumentProperties();
    return props.getProperty(key);
  }

  /**
   * Sets a configuration value in Document Properties.
   * @param {string} key
   * @param {string} value
   */
  function set(key, value) {
    const props = PropertiesService.getDocumentProperties();
    props.setProperty(key, String(value));
  }

  /**
   * Gets all configuration values as a map.
   * @returns {Object}
   */
  function getAll() {
    return PropertiesService.getDocumentProperties().getProperties();
  }

  /**
   * Initializes default values if they don't exist in Document Properties.
   */
  function initializeDefaults() {
    const props = PropertiesService.getDocumentProperties();
    const existing = props.getProperties();
    const toSet = {};

    for (const [key, value] of Object.entries(DEFAULTS)) {
      if (!existing[key]) {
        toSet[key] = String(value);
      }
    }

    if (Object.keys(toSet).length > 0) {
      props.setProperties(toSet);
      console.log("[ConfigManager] Initialized default document properties.");
    }
  }

  return {
    get,
    set,
    getAll,
    initializeDefaults
  };

})();
