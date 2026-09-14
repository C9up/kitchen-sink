/**
 * The redirect half of federated sign-in.
 *
 * No callback route: completing the flow needs a live identity provider, and
 * a route that can never be exercised is worse than one that is absent.
 */
import router from "@c9up/ream/services/router";
import transit from "@c9up/transit/services/main";

router.get("/auth/:provider/redirect", ({ params, response }) => {
	try {
		// The state is the anti-forgery token: a real app stores it in the
		// session and compares it on the way back.
		response.json({ url: transit.redirect(params.provider, "state-123") });
	} catch {
		response.status(404).json({ error: "unknown provider" });
	}
});
