/**
 * Routes exercising prism (images) and vellum (PDF).
 *
 * Inker is NOT wired: its provider's `start()` returns early — leaving the
 * renderer permanently unstarted — and every later resolve then reports
 * "resolved before InkerProvider.start() ran", which fails the whole boot.
 * The dependency is not declared either. See the note in
 * tests/e2e/media.test.ts.
 *
 * Deliberately small and deliberately fed from the REQUEST: the properties
 * worth proving end to end are the ones that only hold against untrusted
 * input — inker escaping by default, prism refusing a bomb before it
 * allocates.
 */
import images from "@c9up/prism/services/main";
import router from "@c9up/ream/services/router";
import { A4, createBlank, inspect as inspectPdf } from "@c9up/vellum";

// Prism: inspect an uploaded image without decoding it.
router.post("/media/inspect", async ({ request, response }) => {
	const encoded = String(request.input("image") ?? "");
	try {
		response.json(images.inspect(Buffer.from(encoded, "base64")));
	} catch (error) {
		response
			.status(422)
			.json({ code: error instanceof Error ? Reflect.get(error, "code") : null });
	}
});

// Prism: a thumbnail, through the whole pipeline.
router.post("/media/thumbnail", async ({ request, response }) => {
	const encoded = String(request.input("image") ?? "");
	const out = await images
		.edit(Buffer.from(encoded, "base64"))
		.resize({ width: 32, height: 32, fit: "cover" })
		.toFormat("png");
	response.json({ base64: out.toString("base64") });
});

// Vellum: author a blank document and read it back.
//
// The barrel's standalone `createBlank`/`inspect`, not the `services/main`
// accessor: authoring needs no configuration, so vellum exposes it as a plain
// function and the service object carries only the operations that do.
router.get("/media/pdf", ({ response }) => {
	const pdf = createBlank([A4]);
	response.json(inspectPdf(pdf));
});
