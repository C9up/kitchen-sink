import { defineConfig } from "@c9up/prism";

/**
 * Image processing.
 *
 * `maxPixels` is the decompression-bomb bound: a 40 KB PNG can declare
 * 50000x50000, and decoding it asks for ten gigabytes before anything
 * objects. Kept low here — a sample app has no business decoding a
 * fifty-megapixel upload.
 */
export default defineConfig({
	limits: { maxPixels: 8_000_000, maxBytes: 8 * 1024 * 1024 },
	quality: 82,
	autoOrient: true,
});
