/**
 * The redirect half of federated sign-in.
 *
 * No callback route: completing the flow needs a live identity provider, and
 * a route that can never be exercised is worse than one that is absent.
 */
import router from "@c9up/ream/services/router";
import transit from "@c9up/transit/services/main";

router.get("/auth/:provider/redirect", ({ params, response }) => {
	// A named segment carries one value, but the type admits an array because
	// a wildcard route can produce one and the router types them alike. This
	// route has no wildcard, so an array here would mean the router changed
	// under us — answer 404 rather than guess which element was meant.
	const provider = params.provider;
	if (typeof provider !== "string") {
		response.status(404).json({ error: "unknown provider" });
		return;
	}
	try {
		// The state is the anti-forgery token: a real app stores it in the
		// session and compares it on the way back.
		response.json({ url: transit.redirect(provider, "state-123") });
	} catch {
		response.status(404).json({ error: "unknown provider" });
	}
});
