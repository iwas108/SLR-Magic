/**
 * Transparent dual-mode compression & decompression utilities for .slr-viewer snapshots.
 * Supports standard Gzip binary compressed files (0x1F, 0x8B magic bytes) and plain UTF-8 JSON.
 */

/**
 * Checks if a byte array starts with the standard Gzip magic header (0x1F, 0x8B).
 */
export function isGzipBuffer(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

/**
 * Decompresses an ArrayBuffer, Uint8Array, or string into a parsed JSON object.
 */
export async function decompressViewerData(input: ArrayBuffer | Uint8Array | string): Promise<any> {
  // If already a plain string
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return JSON.parse(trimmed);
    }
    // Attempt base64 / binary decoding fallback if string contains raw binary
    const bytes = new TextEncoder().encode(input);
    return decompressBytes(bytes);
  }

  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  return decompressBytes(bytes);
}

/**
 * Internal byte decompressor with native DecompressionStream and fallback.
 */
async function decompressBytes(bytes: Uint8Array): Promise<any> {
  if (isGzipBuffer(bytes)) {
    if (typeof DecompressionStream !== 'undefined') {
      try {
        const stream = new Response(new Blob([bytes as any])).body?.pipeThrough(new DecompressionStream('gzip'));
        if (stream) {
          const decompressedText = await new Response(stream).text();
          return JSON.parse(decompressedText);
        }
      } catch (err) {
        console.warn('Native DecompressionStream failed, attempting fallback...', err);
      }
    }
  }

  // Fallback: decode directly as UTF-8 text
  const text = new TextDecoder('utf-8').decode(bytes);
  return JSON.parse(text);
}

/**
 * Compresses a JSON object into a Gzip-compressed Blob (or plain JSON fallback).
 */
export async function compressViewerData(data: any): Promise<Blob> {
  const jsonStr = JSON.stringify(data, null, 2);
  const rawBytes = new TextEncoder().encode(jsonStr);

  if (typeof CompressionStream !== 'undefined') {
    try {
      const stream = new Response(new Blob([rawBytes])).body?.pipeThrough(new CompressionStream('gzip'));
      if (stream) {
        const blob = await new Response(stream).blob();
        return blob;
      }
    } catch (err) {
      console.warn('Native CompressionStream failed, exporting uncompressed JSON...', err);
    }
  }

  return new Blob([jsonStr], { type: 'application/json' });
}
