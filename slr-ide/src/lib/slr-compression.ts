import zlib from 'zlib';

/**
 * Checks whether the provided binary data begins with the GZIP magic numbers (0x1F, 0x8B).
 */
export function isGzipData(data: Uint8Array | ArrayBuffer | Buffer): boolean {
  let bytes: Uint8Array;
  if (data instanceof Uint8Array) {
    bytes = data;
  } else if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else {
    bytes = new Uint8Array(data as any);
  }

  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

/**
 * Server-side compression using Node.js native zlib.
 * Serializes payload to JSON and returns a GZIP-compressed Buffer.
 */
export function compressSlrServer(payload: any): Buffer {
  const jsonString = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  const buffer = Buffer.from(jsonString, 'utf-8');
  return zlib.gzipSync(buffer, { level: 9 });
}

/**
 * Server-side decompression using Node.js native zlib.
 * Transparently accepts GZIP Buffer/ArrayBuffer or uncompressed JSON Buffer/string.
 */
export function decompressSlrServer(data: Buffer | ArrayBuffer | Uint8Array | string): any {
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return JSON.parse(trimmed);
    }
    const buf = Buffer.from(data, 'binary');
    if (isGzipData(buf)) {
      const decompressed = zlib.gunzipSync(buf);
      return JSON.parse(decompressed.toString('utf-8'));
    }
    return JSON.parse(data);
  }

  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as any);
  if (isGzipData(buffer)) {
    const decompressed = zlib.gunzipSync(buffer);
    return JSON.parse(decompressed.toString('utf-8'));
  }

  const text = buffer.toString('utf-8');
  return JSON.parse(text);
}

/**
 * Browser-side compression using Web Streams (CompressionStream).
 * Returns a GZIP-compressed Blob.
 */
export async function compressSlrBrowser(payload: any): Promise<Blob> {
  const jsonString = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  
  if (typeof CompressionStream !== 'undefined') {
    const stream = blob.stream().pipeThrough(new CompressionStream('gzip'));
    const compressedResponse = new Response(stream);
    const compressedBuffer = await compressedResponse.arrayBuffer();
    return new Blob([compressedBuffer], { type: 'application/octet-stream' });
  }

  // Fallback if CompressionStream is unavailable
  return blob;
}

/**
 * Browser-side decompression using Web Streams (DecompressionStream).
 * Automatically detects GZIP compression vs uncompressed JSON text.
 */
export async function decompressSlrBrowser(fileOrBuffer: Blob | File | ArrayBuffer | Uint8Array): Promise<any> {
  let arrayBuffer: ArrayBuffer;
  if (fileOrBuffer instanceof ArrayBuffer) {
    arrayBuffer = fileOrBuffer;
  } else if (fileOrBuffer instanceof Uint8Array) {
    arrayBuffer = fileOrBuffer.buffer.slice(fileOrBuffer.byteOffset, fileOrBuffer.byteOffset + fileOrBuffer.byteLength) as ArrayBuffer;
  } else {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  }

  if (isGzipData(arrayBuffer)) {
    if (typeof DecompressionStream !== 'undefined') {
      const blob = new Blob([arrayBuffer]);
      const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
      const response = new Response(stream);
      const text = await response.text();
      return JSON.parse(text);
    }
    throw new Error('DecompressionStream is not supported in this environment.');
  }

  // Fallback to plain UTF-8 text decoding
  const decoder = new TextDecoder('utf-8');
  const text = decoder.decode(arrayBuffer);
  return JSON.parse(text);
}
