import express from "express";
import auth from "../middleware/authMiddleware.js";
import { getMyNotifications } from "../controllers/notificationsController.js";

const router = express.Router();

router.get("/", auth, getMyNotifications);

export default router;
