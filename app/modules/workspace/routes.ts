import router from "@c9up/ream/services/router";
import WorkspaceController from "./controllers/WorkspaceController.js";

router.post("/workspaces", [WorkspaceController, "create"]).guard("jwt");
router.get("/workspaces", [WorkspaceController, "list"]).guard("jwt");
router.post("/workspaces/:id/invite", [WorkspaceController, "invite"]).guard("jwt");
router.post("/invitations/:token/accept", [WorkspaceController, "accept"]).guard("jwt");
