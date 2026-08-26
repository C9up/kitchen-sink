/**
 * Photon web routes. Registers the PhotonMiddleware globally (it attaches
 * `ctx.photon` to every request and handles X-Photon SPA navigation), then a
 * route that server-renders the `Home` React page.
 */
import server from "@c9up/ream/services/server";
import { PhotonMiddleware } from "@c9up/photon";
import router from "@c9up/ream/services/router";
import photonConfig from "../config/photon.js";

const photonMw = new PhotonMiddleware(photonConfig);
// `server.use()` — a configured instance's handler is a function, and
// `router.use()` takes lazy imports of middleware classes only (AdonisJS shape).
server.use([photonMw.middleware()]);

router.get("/", async ({ photon, response }) => {
	const result = await photon.render("Home", {
		user: { name: "Ada" },
		count: 42,
	});
	response.status(result.status);
	for (const [k, v] of Object.entries(result.headers)) {
		response.header(k, v);
	}
	response.send(result.html);
});
