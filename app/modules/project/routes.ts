import router from "@c9up/ream/services/router";
import ProjectController from "./controllers/ProjectController.js";

router.post("/workspaces/:slug/projects", [ProjectController, "create"]).guard("jwt");
router.get("/workspaces/:slug/projects", [ProjectController, "list"]).guard("jwt");
router.get(
	"/workspaces/:slug/projects/:projectSlug",
	[ProjectController, "show"],
);
