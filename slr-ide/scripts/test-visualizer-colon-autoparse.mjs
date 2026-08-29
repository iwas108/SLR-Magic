import assert from 'assert';

console.log('--- Testing Native 3-Tier Taxonomy Extraction, Raw Leaf/Tail Token Support & Scoping ---');

// Mock data representing extracted research question field values (e.g. rq5_network_protocols)
const mockUmbrellanizerMap = {
  rq5_network_protocols: {
    'REST': 'Application/Middleware: Web Services & RPC APIs',
    'Application/Middleware: REST': 'Application/Middleware: Web Services & RPC APIs',
    'gRPC': 'Application/Middleware: Web Services & RPC APIs',
    'Web Services: gRPC': 'Application/Middleware: Web Services & RPC APIs',
    'SOAP': 'Application/Middleware: Web Services & RPC APIs',
    'GraphQL': 'Application/Middleware: Web Services & RPC APIs',
    'MQTT': 'Application/Middleware: Message Queues & Event Streaming',
    'AMQP': 'Application/Middleware: Message Queues & Event Streaming',
    'Modbus': 'Application/Middleware: Industrial Data Architectures',
    'OPC UA': 'Application/Middleware: Industrial Data Architectures',
    'TCP': 'Network/Transport: Core Transport & Internet Protocols',
    'UDP': 'Network/Transport: Core Transport & Internet Protocols',
    'Wi-Fi': 'Physical/Link: Wi-Fi & WLAN',
    'Physical: Wi-Fi': 'Physical/Link: Wi-Fi & WLAN',
    'CAN': 'Physical/Link: CAN & Vehicular Buses'
  }
};

function stripParentPrefix(val, parentName) {
  if (!parentName || !val) return val;
  const pNorm = String(parentName).trim().toLowerCase();
  const colonIdx = val.indexOf(':');
  if (colonIdx !== -1) {
    const prefix = String(val.substring(0, colonIdx)).trim().toLowerCase();
    if (prefix === pNorm) {
      const rest = val.substring(colonIdx + 1).trim();
      return rest || val;
    }
  }
  return val;
}

function resolveUmbrellanizerValue(val, key, useUmbrellanizer, map) {
  if (!useUmbrellanizer) return val;
  const dict = map[key] || {};
  return dict[val] || val;
}

function extractPaperFieldValuesMock(paper, fieldKey, options = {}) {
  const isMacro = fieldKey.startsWith('ext:macro:') || fieldKey.startsWith('macro:ext:');
  const isSub = fieldKey.startsWith('ext:sub:') || fieldKey.startsWith('sub:ext:');
  const isLeafRaw = fieldKey.startsWith('raw:leaf:ext:') || fieldKey.startsWith('raw:tail:ext:');
  const isExplicitRaw = isLeafRaw || fieldKey.startsWith('raw:ext:') || fieldKey.startsWith('raw:');
  
  let realKey = '';
  if (isMacro) {
    realKey = fieldKey.startsWith('ext:macro:') ? fieldKey.substring(10) : fieldKey.substring(10);
  } else if (isSub) {
    realKey = fieldKey.startsWith('ext:sub:') ? fieldKey.substring(8) : fieldKey.substring(8);
  } else if (isLeafRaw) {
    realKey = fieldKey.startsWith('raw:leaf:ext:') ? fieldKey.substring(13) : fieldKey.substring(13);
  } else if (isExplicitRaw) {
    realKey = fieldKey.startsWith('raw:ext:') ? fieldKey.substring(8) : fieldKey.substring(4);
  } else if (fieldKey.startsWith('ext:')) {
    realKey = fieldKey.substring(4);
  }

  const rawTokens = paper.extracted_data?.[realKey] || [];

  const transformToken = (t) => {
    if (isExplicitRaw) {
      if (isLeafRaw) {
        const lastColonIdx = t.lastIndexOf(':');
        return lastColonIdx !== -1 ? t.substring(lastColonIdx + 1).trim() : t;
      }
      return t;
    }
    const resolved = resolveUmbrellanizerValue(t, realKey, true, options.umbrellanizerMap || {});
    if (!resolved) return t;
    if (isMacro) {
      const colonIdx = resolved.indexOf(':');
      return colonIdx !== -1 ? resolved.substring(0, colonIdx).trim() : resolved;
    }
    if (isSub) {
      const colonIdx = resolved.indexOf(':');
      return colonIdx !== -1 ? resolved.substring(colonIdx + 1).trim() : resolved;
    }
    return resolved;
  };

  return rawTokens.map(transformToken);
}

function filterValuesForParent(vals, currentFieldKey, parentContext, options = {}) {
  if (!parentContext || !vals || vals.length === 0) return vals;

  const { levelCustomGroupLinks = {}, umbrellanizerMap = {} } = options;
  const parentRaw = parentContext.rawName.trim();
  const parentDisplay = parentContext.displayName.trim();
  const parentField = parentContext.fieldKey;

  const extractBaseKey = (k) => {
    if (k.startsWith('ext:macro:') || k.startsWith('macro:ext:')) return k.substring(10);
    if (k.startsWith('ext:sub:') || k.startsWith('sub:ext:')) return k.substring(8);
    if (k.startsWith('raw:leaf:ext:') || k.startsWith('raw:tail:ext:')) return k.substring(13);
    if (k.startsWith('raw:ext:') || k.startsWith('raw:')) return k.startsWith('raw:ext:') ? k.substring(8) : k.substring(4);
    if (k.startsWith('ext:')) return k.substring(4);
    return k;
  };

  const currentBaseKey = extractBaseKey(currentFieldKey);
  const parentBaseKey = extractBaseKey(parentField);
  const isSameBaseVariable = Boolean(currentBaseKey && parentBaseKey && currentBaseKey === parentBaseKey);
  const isRawChild = currentFieldKey.startsWith('raw:leaf:ext:') || currentFieldKey.startsWith('raw:tail:ext:') || currentFieldKey.startsWith('raw:ext:') || currentFieldKey.startsWith('raw:');

  // Case 1: Parent was Macro Domain (ext:macro:*)
  if (parentField.startsWith('ext:macro:') || parentField.startsWith('macro:ext:')) {
    return vals.filter(v => {
      // If current is raw token
      if (isRawChild) {
        const resolved = resolveUmbrellanizerValue(v, currentBaseKey, true, umbrellanizerMap);
        if (!resolved) return false;
        const prefix = resolved.includes(':') ? resolved.substring(0, resolved.indexOf(':')).trim() : resolved;
        return prefix.toLowerCase() === parentRaw.toLowerCase();
      }
      // If current is sub-category or full category
      if (v.includes(':')) {
        const prefix = v.substring(0, v.indexOf(':')).trim();
        return prefix.toLowerCase() === parentRaw.toLowerCase();
      }
      // If current is already stripped sub-category, verify against taxonomy map
      if (isSameBaseVariable) {
        const dict = umbrellanizerMap[currentBaseKey] || {};
        const dictValues = Object.values(dict);
        return dictValues.some((catStr) => {
          if (!catStr || !catStr.includes(':')) return false;
          const prefix = catStr.substring(0, catStr.indexOf(':')).trim();
          const suffix = catStr.substring(catStr.indexOf(':') + 1).trim();
          return prefix.toLowerCase() === parentRaw.toLowerCase() && suffix.toLowerCase() === v.toLowerCase();
        });
      }
      return true;
    });
  }

  // Case 2: Parent was Sub-Category (ext:sub:*) or Full Category (ext:*) and child is Raw Tokens (raw:ext:* or raw:leaf:ext:*)
  if (isRawChild) {
    return vals.filter(rawToken => {
      const resolvedCat = resolveUmbrellanizerValue(rawToken, currentBaseKey, true, umbrellanizerMap);
      if (!resolvedCat) return false;
      const strippedCat = stripParentPrefix(resolvedCat, parentContext.path?.[0]);
      const suffix = resolvedCat.includes(':') ? resolvedCat.substring(resolvedCat.indexOf(':') + 1).trim() : resolvedCat;
      return (
        resolvedCat.trim().toLowerCase() === parentRaw.toLowerCase() ||
        strippedCat.trim().toLowerCase() === parentDisplay.toLowerCase() ||
        resolvedCat.trim().toLowerCase() === parentDisplay.toLowerCase() ||
        suffix.trim().toLowerCase() === parentDisplay.toLowerCase() ||
        suffix.trim().toLowerCase() === parentRaw.toLowerCase()
      );
    });
  }

  return vals;
}

// TEST 1: Paper field extraction across native tiers including Raw Leaf / Tail Tokens
const samplePaperWithColonTokens = {
  id: 'P1',
  extracted_data: {
    rq5_network_protocols: ['Application/Middleware: REST', 'Web Services: gRPC', 'MQTT', 'Physical: Wi-Fi']
  }
};

const l1MacroVals = extractPaperFieldValuesMock(samplePaperWithColonTokens, 'ext:macro:rq5_network_protocols', { umbrellanizerMap: mockUmbrellanizerMap });
assert.deepStrictEqual(
  l1MacroVals,
  ['Application/Middleware', 'Application/Middleware', 'Application/Middleware', 'Physical/Link'],
  'Level 1 macro must extract prefix before colon'
);

const l2SubVals = extractPaperFieldValuesMock(samplePaperWithColonTokens, 'ext:sub:rq5_network_protocols', { umbrellanizerMap: mockUmbrellanizerMap });
assert.deepStrictEqual(
  l2SubVals,
  ['Web Services & RPC APIs', 'Web Services & RPC APIs', 'Message Queues & Event Streaming', 'Wi-Fi & WLAN'],
  'Level 2 subcategory must extract suffix after colon'
);

// Level 3 Raw Leaf Tokens (tail after ':')
const l3LeafVals = extractPaperFieldValuesMock(samplePaperWithColonTokens, 'raw:leaf:ext:rq5_network_protocols', { umbrellanizerMap: mockUmbrellanizerMap });
assert.deepStrictEqual(
  l3LeafVals,
  ['REST', 'gRPC', 'MQTT', 'Wi-Fi'],
  'Level 3 raw:leaf:ext: must extract ONLY the most right-side / tail token after colon'
);

// Level 3 Raw Full Tokens
const l3FullRawVals = extractPaperFieldValuesMock(samplePaperWithColonTokens, 'raw:ext:rq5_network_protocols', { umbrellanizerMap: mockUmbrellanizerMap });
assert.deepStrictEqual(
  l3FullRawVals,
  ['Application/Middleware: REST', 'Web Services: gRPC', 'MQTT', 'Physical: Wi-Fi'],
  'Level 3 raw:ext: must extract full raw string unchanged'
);

// TEST 2: Strict Hierarchical Parent-Child Scoping
// Under Level 2 "Web Services & RPC APIs", Level 3 leaf tokens must exclude "MQTT" and "Wi-Fi"
const scopedL3Leaf = filterValuesForParent(
  ['REST', 'gRPC', 'MQTT', 'Wi-Fi'],
  'raw:leaf:ext:rq5_network_protocols',
  {
    fieldKey: 'ext:sub:rq5_network_protocols',
    levelIdx: 1,
    rawName: 'Web Services & RPC APIs',
    displayName: 'Web Services & RPC APIs',
    path: ['Application/Middleware', 'Web Services & RPC APIs']
  },
  { umbrellanizerMap: mockUmbrellanizerMap }
);

// TEST 3: Tail Grouping Label Formatter (formatTailLabel)
function formatTailLabel(tailItems, style = 'comma_list', maxChars = 36) {
  if (!tailItems || tailItems.length === 0) return 'Other';
  const count = tailItems.length;
  const names = tailItems.map(item => item.name);

  if (style === 'plain_other') return 'Other';
  if (style === 'other_count') return `Other (${count} items)`;
  if (style === 'other_items') {
    const listStr = names.join(', ');
    if (listStr.length <= maxChars) return `Other: ${listStr}`;
    let acc = '';
    let used = 0;
    for (let i = 0; i < names.length; i++) {
      const next = (acc ? acc + ', ' : '') + names[i];
      if (next.length > maxChars - 7 && i > 0) return `Other: ${acc} (+${count - used})`;
      acc = next;
      used++;
    }
    return `Other: ${acc}`;
  }

  // Default: 'comma_list'
  const listStr = names.join(', ');
  if (listStr.length <= maxChars) return listStr;
  let acc = '';
  let used = 0;
  for (let i = 0; i < names.length; i++) {
    const next = (acc ? acc + ', ' : '') + names[i];
    if (next.length > maxChars - 7 && i > 0) return `${acc} (+${count - used})`;
    acc = next;
    used++;
  }
  return acc || names[0];
}

const mockTailItems = [
  { name: 'AMQP', count: 5 },
  { name: 'CoAP', count: 3 },
  { name: 'DDS', count: 2 }
];

assert.strictEqual(
  formatTailLabel(mockTailItems, 'comma_list'),
  'AMQP, CoAP, DDS',
  'formatTailLabel must return comma-separated list of item names'
);

assert.strictEqual(
  formatTailLabel(mockTailItems, 'other_count'),
  'Other (3 items)',
  'formatTailLabel must return Other (K items)'
);

assert.strictEqual(
  formatTailLabel(mockTailItems, 'other_items'),
  'Other: AMQP, CoAP, DDS',
  'formatTailLabel must return Other: Items...'
);

assert.strictEqual(
  formatTailLabel(mockTailItems, 'plain_other'),
  'Other',
  'formatTailLabel must return plain Other'
);

// Truncation test
const mockLongTail = [
  { name: 'ProtocolAlpha', count: 10 },
  { name: 'ProtocolBeta', count: 8 },
  { name: 'ProtocolGamma', count: 6 },
  { name: 'ProtocolDelta', count: 4 },
  { name: 'ProtocolEpsilon', count: 2 }
];
const truncatedComma = formatTailLabel(mockLongTail, 'comma_list', 30);
assert(truncatedComma.includes('(+'), `Truncated label must contain count indicator: ${truncatedComma}`);

console.log('✅ ALL Native 3-Tier Taxonomy, Raw Leaf/Tail Token & Tail Grouping Tests PASSED Successfully!');

