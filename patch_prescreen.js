const fs = require('fs');
let content = fs.readFileSync('inter-rater/src/components/PreScreen.jsx', 'utf8');

// The original issue was it used PROJECT_NAME, RESEARCH_QUESTIONS, etc.,
// but the payload exports `projectName`, `researchQuestions`, etc.
// Our stash had the correct change, but we had a conflict or didn't merge properly.

// Let's ensure it's using the correct camelCase keys.
content = content.replace(/metadata\.PROJECT_NAME/g, "metadata.projectName");
content = content.replace(/metadata\.RESEARCH_QUESTIONS/g, "metadata.researchQuestions");
content = content.replace(/metadata\.INCLUSION_CRITERIA/g, "metadata.inclusionCriteria");
content = content.replace(/metadata\.EXCLUSION_CRITERIA/g, "metadata.exclusionCriteria");

fs.writeFileSync('inter-rater/src/components/PreScreen.jsx', content);
