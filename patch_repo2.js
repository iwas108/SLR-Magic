const fs = require('fs');
let content = fs.readFileSync('llm-proxy/backend/src/repositories/CacheRepository.js', 'utf8');

content = content.replace(
/  async getEndpointLabels\(\) \{\n    const stmt = this\.db\.prepare\('SELECT endpoint_url, provider as label FROM local_endpoints'\);\n    const rows = stmt\.all\(\);\n    const result = \{\};\n    for \(const row of rows\) \{\n      result\[row\.endpoint_url\] = row\.label;\n    \}\n    return result;\n  \}\n/g,
`  async getEndpointLabels() {
    const stmt = this.db.prepare('SELECT endpoint_url, provider as label FROM local_endpoints');
    const rows = stmt.all();
    const result = {};
    for (const row of rows) {
      result[row.endpoint_url] = row.label;
    }
    return result;
  }
`
);

fs.writeFileSync('llm-proxy/backend/src/repositories/CacheRepository.js', content);
