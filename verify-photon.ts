process.env.NODE_ENV = "production";
const { PhotonRenderer } = await import("@c9up/photon");

const renderer = new PhotonRenderer({
	framework: "react",
	entryClient: "resources/app.tsx",
	entryServer: "resources/ssr.tsx",
	buildDir: "public/build",
});
await renderer.boot();
const result = await renderer.render("Home", {
	user: { name: "Ada" },
	count: 42,
});
const html = result.html;

const checks: Record<string, boolean> = {
	// React inserts `<!-- -->` markers between static text and interpolated
	// values, so match tolerantly rather than on an exact substring.
	"react SSR output (Hello … Ada)": /Hello,.*Ada/s.test(html),
	"props rendered (count 42)": /Server-rendered count:.*42/s.test(html),
	"photon-data script block": html.includes('id="photon-data"'),
	"client module <script>": /<script type="module" src=/.test(html),
	"app mount div": html.includes('<div id="app">'),
};
console.log(JSON.stringify(checks, null, 2));
const ok = Object.values(checks).every(Boolean);
console.log(ok ? "VERIFY: PASS" : "VERIFY: FAIL");
if (!ok) console.log(html.slice(0, 700));
process.exit(ok ? 0 : 1);
