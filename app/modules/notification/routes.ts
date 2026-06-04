import router from "@c9up/ream/services/router";
import NotificationController from "./controllers/NotificationController.js";

router.get("/me/notifications", [NotificationController, "list"]).guard("jwt");
router.post(
	"/me/notifications/:id/read",
	[NotificationController, "markRead"],
).guard("jwt");
