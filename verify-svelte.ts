process.env.NODE_ENV = "production";
const { PhotonRenderer } = await import("@c9up/photon");

const renderer = new PhotonRenderer({
	framework: "svelte",
	entryClient: "resources/svelte/app.ts",
	entryServer: "resources/svelte/ssr.ts",
	buildDir: "public/build/svelte",
});
await renderer.boot();
const result = await renderer.render("Home", {
	user: { name: "Ada" },
	count: 42,
});
const html = result.html;

const checks: Record<string, boolean> = {
	"svelte SSR output (Hello … Ada)": /Hello,.*Ada/s.test(html),
	"props rendered (count 42)": /Server-rendered count:.*42/s.test(html),
	"photon-data framework=svelte": html.includes('"framework":"svelte"'),
	"client module <script>": /<script type="module" src=/.test(html),
};
console.log(JSON.stringify(checks, null, 2));
const ok = Object.values(checks).every(Boolean);
console.log(ok ? "VERIFY: PASS" : "VERIFY: FAIL");
if (!ok) console.log(html.slice(0, 700));
process.exit(ok ? 0 : 1);
