import router from "@c9up/ream/services/router";
import TaskController from "./controllers/TaskController.js";

router.post("/projects/:projectId/tasks", [TaskController, "create"]).guard("jwt");
router.get("/projects/:projectId/tasks", [TaskController, "list"]).guard("jwt");
router.patch("/tasks/:id", [TaskController, "update"]).guard("jwt");
