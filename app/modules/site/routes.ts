import router from "@c9up/ream/services/router";
import SiteController from "./controllers/SiteController.js";

router.get(
	"/pages/workspaces/:wsSlug/projects/:projectSlug",
	[SiteController, "showProject"],
);
router.get(
	"/pages/live/workspaces/:wsSlug/projects/:projectSlug",
	[SiteController, "showProjectLive"],
);
