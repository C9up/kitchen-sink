import router from "@c9up/ream/services/router";
import CommentController from "./controllers/CommentController.js";

router.post("/tasks/:id/comments", [CommentController, "create"]).guard("jwt");
router.get("/tasks/:id/comments", [CommentController, "list"]).guard("jwt");
