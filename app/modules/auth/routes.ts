import router from "@c9up/ream/services/router";
import AuthController from "./controllers/AuthController.js";

router.post("/auth/signup", [AuthController, "signup"]);
router.post("/auth/login", [AuthController, "login"]);
router.post("/auth/logout", [AuthController, "logout"]);
router.get("/me", [AuthController, "me"]);
