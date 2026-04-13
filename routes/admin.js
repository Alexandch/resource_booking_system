import express from "express";
import auth from "../middleware/authMiddleware.js";
import checkRole from "../middleware/roleMiddleware.js";

import {
  getUsers,
  createUser,
  deleteUser,
  toggleRole,
  toggleBlock,
  getLogs,
  getResourceById,
  updateResource,
  getBuildings,
  getResourceTypes
} from "../controllers/adminController.js";
import { getLogs as getLogsFromMongo } from '../controllers/logController.js';

const router = express.Router();

/* ===== USERS ===== */
router.get("/users", auth, checkRole([1]), getUsers);
router.post("/users", auth, checkRole([1]), createUser);
router.delete("/users/:id", auth, checkRole([1]), deleteUser);
router.put("/users/role/:id", auth, checkRole([1]), toggleRole);
router.put("/users/block/:id", auth, checkRole([1]), toggleBlock);

/* ===== RESOURCES (ADMIN) ===== */
router.get("/resources/:id", auth, checkRole([1]), getResourceById);
router.put("/resources/:id", auth, checkRole([1]), updateResource);

/* ===== LOGS ===== */
router.get("/logs", auth, checkRole([1]), getLogsFromMongo);

router.get('/resource-types', auth, checkRole([1]), getResourceTypes);
router.get('/buildings', auth, checkRole([1]), getBuildings);

export default router;
