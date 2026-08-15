import zlib from 'zlib';
import { compressSlrServer, decompressSlrServer, isGzipData } from '../slr-ide/src/lib/slr-compression.ts';
import { compressSlr, decompressSlr, isGzipData as isGzipDataBrowser } from '../inter-rater/src/lib/slrCompression.js';

async function runTests() {
  console.log('--- Testing SLR Compression Pipeline ---');

  // Test Payload 1: Basic Pool A Metadata & Papers
  const poolAPayload = {
    metadata: {
      project_id: 'proj-123456',
      project_name: 'Test Project',
      pool_type: 'CAL_Pool_A',
      export_date: new Date().toISOString()
    },
    papers: [
      {
        Paper_ID: 'Smith_2024_SLR_a1b2',
        Title: 'Systematic Literature Review of Deep Learning',
        Year: '2024',
        Abstract: 'We explore automated SLR mechanisms...',
        Human_Decision: 'Include',
        Human_Rationale: 'Meets criteria'
      },
      {
        Paper_ID: 'Doe_2023_ML_c3d4',
        Title: 'Machine Learning Survey',
        Year: '2023',
        Abstract: 'Survey on ML techniques...',
        Human_Decision: 'Exclude',
        Human_EC_Trigger: 'EC-1',
        Human_Rationale: 'Not an empirical evaluation'
      }
    ]
  };

  // Test 1: Node compress -> Node decompress
  const compressedBuffer = compressSlrServer(poolAPayload);
  console.log(`Original JSON size: ${Buffer.byteLength(JSON.stringify(poolAPayload, null, 2))} bytes`);
  console.log(`Compressed GZIP size: ${compressedBuffer.length} bytes`);
  console.log(`isGzipData: ${isGzipData(compressedBuffer)}`);

  if (!isGzipData(compressedBuffer)) {
    throw new Error('Test 1 Failed: Buffer is not detected as GZIP');
  }

  const decompressedObj = decompressSlrServer(compressedBuffer);
  if (JSON.stringify(decompressedObj) !== JSON.stringify(poolAPayload)) {
    throw new Error('Test 1 Failed: Decompressed payload does not match original');
  }
  console.log('✅ Test 1 Passed: Node zlib compression roundtrip verified.');

  // Test 2: Legacy uncompressed JSON backward compatibility
  const plainJsonString = JSON.stringify(poolAPayload, null, 2);
  const plainBuffer = Buffer.from(plainJsonString, 'utf-8');
  console.log(`isGzipData on plain JSON: ${isGzipData(plainBuffer)}`);
  const legacyDecompressed = decompressSlrServer(plainBuffer);
  if (JSON.stringify(legacyDecompressed) !== JSON.stringify(poolAPayload)) {
    throw new Error('Test 2 Failed: Legacy plain JSON decompress failed');
  }
  console.log('✅ Test 2 Passed: Backward compatibility with legacy plain JSON verified.');

  // Test 3: Large payload with synthetic base64 PDF
  const largeBase64 = Buffer.alloc(1024 * 500, 'PDF-DATA-STREAM-SAMPLE-CONTENT-ABCD-1234').toString('base64');
  const poolCPayload = {
    metadata: {
      project_id: 'proj-123456',
      pool_type: 'QC_Batch',
      batch_id: 'rb-test',
      export_date: new Date().toISOString()
    },
    papers: [
      {
        Paper_ID: 'Large_Paper_2025_x9y8',
        Title: 'Extensive Analysis Paper',
        PDF_Base64: largeBase64,
        Human_QA_Scores: { 'QA-1': { value: 3, evidence: 'Rigorous sample' } },
        Human_Extracted_Data: { 'Model': { value: 'BERT-Large', evidence: 'Section 3.2' } }
      }
    ]
  };

  const largeOriginalBytes = Buffer.byteLength(JSON.stringify(poolCPayload));
  const largeCompressed = compressSlrServer(poolCPayload);
  const largeRatio = ((1 - largeCompressed.length / largeOriginalBytes) * 100).toFixed(2);
  console.log(`Large Pool C/QC_Batch Payload: ${largeOriginalBytes} bytes -> ${largeCompressed.length} bytes (${largeRatio}% compression ratio)`);

  const largeDecompressed = decompressSlrServer(largeCompressed);
  if (largeDecompressed.papers[0].PDF_Base64 !== largeBase64) {
    throw new Error('Test 3 Failed: Large payload decompression mismatch');
  }
  console.log('✅ Test 3 Passed: High-ratio compression on base64 PDF payloads verified.');

  // Test 4: Web Streams Browser module in Node environment (Node 18+ has native CompressionStream)
  if (typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined') {
    const browserBlob = await compressSlr(poolAPayload);
    const browserArrayBuffer = await browserBlob.arrayBuffer();
    console.log(`Browser compressSlr output: ${browserArrayBuffer.byteLength} bytes, isGzip: ${isGzipDataBrowser(browserArrayBuffer)}`);

    const browserDecompressed = await decompressSlr(browserArrayBuffer);
    if (JSON.stringify(browserDecompressed) !== JSON.stringify(poolAPayload)) {
      throw new Error('Test 4 Failed: Browser decompress mismatch');
    }

    // Cross-compat: Browser compressed -> Node decompress
    const crossNodeDecompressed = decompressSlrServer(Buffer.from(browserArrayBuffer));
    if (JSON.stringify(crossNodeDecompressed) !== JSON.stringify(poolAPayload)) {
      throw new Error('Test 4 Failed: Browser compressed -> Node decompress mismatch');
    }

    // Cross-compat: Node compressed -> Browser decompress
    const crossBrowserDecompressed = await decompressSlr(compressedBuffer);
    if (JSON.stringify(crossBrowserDecompressed) !== JSON.stringify(poolAPayload)) {
      throw new Error('Test 4 Failed: Node compressed -> Browser decompress mismatch');
    }

    console.log('✅ Test 4 Passed: Full cross-compatibility between Browser Web Streams and Node zlib verified.');
  } else {
    console.log('ℹ️ Node environment does not have global CompressionStream, skipping stream tests');
  }

  console.log('🎉 ALL COMPRESSION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
