import express from "express";
import auth from "../middleware/authMiddleware.js";
import { getResources, getResourceById } from "../controllers/resourcesController.js";

const router = express.Router();

router.get("/", auth, getResources);
router.get("/:id", auth, getResourceById);

export default router;
