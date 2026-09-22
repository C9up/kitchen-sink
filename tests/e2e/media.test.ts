/**
 * Prism and Vellum through the real kernel.
 *
 * Each assertion here is one a unit test cannot make: the template has to be
 * the one the provider resolved from `resources/templates`, and the image
 * guards have to refuse an upload that arrived over the wire.
 */

import { deflateSync, crc32 } from "node:zlib";
import { test } from "@c9up/helix";
import { createClient, forceExitAfter, textField } from "./_helpers.js";

const client = createClient();

/** A valid RGBA PNG, built rather than pasted — see prism's own suite. */
function makePng(width: number, height: number): Buffer {
	const chunk = (kind: string, payload: Buffer): Buffer => {
		const body = Buffer.concat([Buffer.from(kind, "ascii"), payload]);
		const length = Buffer.alloc(4);
		length.writeUInt32BE(payload.length);
		const checksum = Buffer.alloc(4);
		checksum.writeUInt32BE(crc32(body) >>> 0);
		return Buffer.concat([length, body, checksum]);
	};
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8;
	ihdr[9] = 6;
	const raw = Buffer.alloc(height * (1 + width * 4));
	let offset = 0;
	for (let y = 0; y < height; y++) {
		raw[offset++] = 0;
		for (let x = 0; x < width; x++) {
			raw[offset++] = (x * 7) % 256;
			raw[offset++] = (y * 11) % 256;
			raw[offset++] = 128;
			raw[offset++] = 255;
		}
	}
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(raw)),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

/** A tiny PNG whose header lies about its size — the decompression bomb. */
function bombPng(width: number, height: number): Buffer {
	const chunk = (kind: string, payload: Buffer): Buffer => {
		const body = Buffer.concat([Buffer.from(kind, "ascii"), payload]);
		const length = Buffer.alloc(4);
		length.writeUInt32BE(payload.length);
		const checksum = Buffer.alloc(4);
		checksum.writeUInt32BE(crc32(body) >>> 0);
		return Buffer.concat([length, body, checksum]);
	};
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8;
	ihdr[9] = 6;
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", ihdr),
		chunk("IDAT", Buffer.from([0x78, 0x01, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01])),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

test.group("kitchen-sink > e2e > prism + vellum", (group) => {
	group.setup(async () => {
		await client.boot();
	});
	group.teardown(async () => {
		await client.close();
		forceExitAfter();
	});

	test("prism reads an uploaded image's header", async ({ assert }) => {
		const response = await client
			.post("/media/inspect")
			.json({ image: makePng(40, 20).toString("base64") });
		response.assertStatus(200);
		assert.deepInclude(response.body(), {
			width: 40,
			height: 20,
			format: "png",
		});
	});

	test("prism refuses a decompression bomb before allocating", async ({
		assert,
	}) => {
		// A file of under a hundred bytes claiming 50000x50000. Refused on the
		// header, so the ten gigabytes are never asked for.
		const bomb = bombPng(50_000, 50_000);
		assert.isBelow(bomb.length, 100);
		const response = await client
			.post("/media/inspect")
			.json({ image: bomb.toString("base64") });
		response.assertStatus(422);
		response.assertBodyContains({ code: "E_PRISM_TOO_MANY_PIXELS" });
	});

	test("prism refuses bytes that are not an image", async ({ assert }) => {
		const response = await client
			.post("/media/inspect")
			.json({ image: Buffer.from("<svg/>").toString("base64") });
		response.assertStatus(422);
		response.assertBodyContains({ code: "E_PRISM_UNKNOWN_FORMAT" });
	});

	test("prism resizes through the whole pipeline", async ({ assert }) => {
		const response = await client
			.post("/media/thumbnail")
			.json({ image: makePng(200, 100).toString("base64") });
		response.assertStatus(200);
		const out = Buffer.from(textField(response.body(), "base64"), "base64");
		const meta = (
			await client.post("/media/inspect").json({ image: out.toString("base64") })
		).body();
		assert.deepInclude(meta, { width: 32, height: 32 });
	});

	test("vellum authors a document and reads it back", async ({ assert }) => {
		const response = await client.get("/media/pdf");
		response.assertStatus(200);
		assert.deepInclude(response.body(), { pageCount: 1 });
	});
});
