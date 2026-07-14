const Database = require('better-sqlite3');
const path = require('path');

function resolveModelPrices(modelId) {
  const nameLower = modelId.toLowerCase();
  const pricingMatrix = {
    "gemini-3.1-flash-lite": [0.25, 1.50],
    "gemini-3-flash-preview": [0.50, 3.00],
    "gemini-3.1-pro-preview": [2.00, 12.00],
    "gemini-2.5-flash": [0.075, 0.30],
    "gemini-2.5-pro": [1.25, 5.00],
    "gemini-1.5-flash": [0.075, 0.30],
    "gemini-1.5-pro": [1.25, 5.00],
    "gemma": [0.00, 0.00]
  };
  
  for (const [key, rates] of Object.entries(pricingMatrix)) {
    if (nameLower.includes(key)) {
      return rates;
    }
  }
  
  if (nameLower.includes("gemma")) {
    return [0.00, 0.00];
  }
  
  const isPro = nameLower.includes("pro") || nameLower.includes("ultra");
  const inputPrice = isPro ? 1.25 : 0.075;
  const outputPrice = isPro ? 5.00 : 0.30;
  return [inputPrice, outputPrice];
}

async function run() {
  const dbPath = path.join(__dirname, '../db/slr.db');
  console.log(`Connecting to database at: ${dbPath}`);
  const db = new Database(dbPath);
  
  // Enable WAL and foreign keys
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Load active pricing lookup map
  const pricingRows = db.prepare('SELECT * FROM llm_pricing').all();
  const pricingMap = new Map();
  for (const row of pricingRows) {
    pricingMap.set(row.model_id, row);
  }

  // Load active projects to lookup tax rates
  const projectRows = db.prepare('SELECT id, project_tax FROM projects').all();
  const projectTaxMap = new Map();
  for (const row of projectRows) {
    projectTaxMap.set(row.id, row.project_tax || 0.0);
  }

  // Load all audit trail records
  const auditLogs = db.prepare('SELECT * FROM llm_audit_log').all();
  console.log(`Found ${auditLogs.length} audit trail entries to process.`);

  // Recalculate each log entry cost
  const updateStmt = db.prepare('UPDATE llm_audit_log SET cost_usd = ? WHERE id = ?');
  
  db.transaction(() => {
    let updatedCount = 0;
    for (const log of auditLogs) {
      if (log.status !== 'SUCCESS') {
        continue;
      }
      
      let inputRate = 0.0;
      let outputRate = 0.0;
      
      const matchedPricing = pricingMap.get(log.model_id);
      if (matchedPricing) {
        inputRate = matchedPricing.input_token_price;
        outputRate = matchedPricing.output_token_price;
      } else {
        const [fallbackInput, fallbackOutput] = resolveModelPrices(log.model_id);
        inputRate = fallbackInput;
        outputRate = fallbackOutput;
      }
      
      // Force 50% discount as requested
      const flexDiscount = 0.5;
      const priceMultiplier = 1.0 - flexDiscount;
      
      inputRate *= priceMultiplier;
      outputRate *= priceMultiplier;
      
      const billableInput = Math.max(0, (log.input_tokens || 0) - (log.cached_tokens || 0));
      const totalOutput = (log.output_tokens || 0) + (log.thinking_tokens || 0);
      
      const rawCost = ((billableInput / 1000000.0) * inputRate) + ((totalOutput / 1000000.0) * outputRate);
      
      // Get project tax rate
      const taxRate = projectTaxMap.get(log.project_id) || 0.0;
      const recalculatedCost = rawCost * (1.0 + taxRate);
      
      updateStmt.run(recalculatedCost, log.id);
      updatedCount++;
    }
    console.log(`Recalculated and updated ${updatedCount} SUCCESS logs.`);
  })();

  // Recalculate project total spend
  console.log('Recalculating project cumulative spends...');
  const projects = db.prepare('SELECT id, name FROM projects').all();
  
  db.transaction(() => {
    for (const proj of projects) {
      const sumRow = db.prepare('SELECT SUM(cost_usd) as total FROM llm_audit_log WHERE project_id = ?').get(proj.id);
      const totalSpend = sumRow && sumRow.total ? sumRow.total : 0.0;
      
      db.prepare('UPDATE projects SET project_current_spend = ? WHERE id = ?').run(totalSpend, proj.id);
      console.log(`Project "${proj.name}" (${proj.id}) current spend updated to: $${totalSpend.toFixed(6)}`);
    }
  })();

  console.log('Recalculation database patch completed successfully!');
  db.close();
}

run().catch(err => {
  console.error('Recalculation script failed:', err);
  process.exit(1);
});
