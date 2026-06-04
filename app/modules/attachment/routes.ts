import router from "@c9up/ream/services/router";
import AttachmentController from "./controllers/AttachmentController.js";

router.post("/tasks/:id/attachments", [AttachmentController, "create"]).guard("jwt");
router.get("/tasks/:id/attachments", [AttachmentController, "list"]).guard("jwt");
router.get("/attachments/:id/download", [AttachmentController, "download"]).guard("jwt");
