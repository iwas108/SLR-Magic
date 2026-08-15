/**
 * slrCompression.js
 * Universal client-side compression/decompression utilities for SLR review files (.slr)
 * Uses native Web Streams (CompressionStream & DecompressionStream) with zero external dependencies.
 */

/**
 * Checks whether the binary data begins with the GZIP magic numbers (0x1F, 0x8B).
 * @param {Uint8Array|ArrayBuffer} data 
 * @returns {boolean}
 */
export function isGzipData(data) {
  const bytes = data instanceof Uint8Array 
    ? data 
    : new Uint8Array(data);

  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

/**
 * Compresses payload (object or JSON string) to a GZIP-compressed Blob.
 * @param {object|string} payload 
 * @returns {Promise<Blob>}
 */
export async function compressSlr(payload) {
  const jsonString = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });

  if (typeof CompressionStream !== 'undefined') {
    const stream = blob.stream().pipeThrough(new CompressionStream('gzip'));
    const compressedResponse = new Response(stream);
    const compressedBuffer = await compressedResponse.arrayBuffer();
    return new Blob([compressedBuffer], { type: 'application/octet-stream' });
  }

  // Fallback if CompressionStream is unsupported
  return blob;
}

/**
 * Decompresses an SLR file/Blob/ArrayBuffer into a parsed JavaScript object.
 * Transparently supports both GZIP-compressed .slr files and legacy plain JSON .slr files.
 * @param {Blob|File|ArrayBuffer|Uint8Array} fileOrBuffer 
 * @returns {Promise<any>}
 */
export async function decompressSlr(fileOrBuffer) {
  let arrayBuffer;
  if (fileOrBuffer instanceof ArrayBuffer) {
    arrayBuffer = fileOrBuffer;
  } else if (fileOrBuffer instanceof Uint8Array) {
    arrayBuffer = fileOrBuffer.buffer.slice(fileOrBuffer.byteOffset, fileOrBuffer.byteOffset + fileOrBuffer.byteLength);
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
    throw new Error('DecompressionStream is not supported in this browser.');
  }

  // Legacy uncompressed UTF-8 JSON text fallback
  const decoder = new TextDecoder('utf-8');
  const text = decoder.decode(arrayBuffer);
  return JSON.parse(text);
}
