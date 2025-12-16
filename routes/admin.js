import express from "express";
import auth from "../middleware/authMiddleware.js";
import checkRole from "../middleware/roleMiddleware.js";

import { 
    getUsers,
    createUser,
    deleteUser,
    toggleRole,
    toggleBlock,
    getLogs
} from "../controllers/adminController.js";

const router = express.Router();

// ---- USERS ----
router.get("/users", auth, checkRole([1]), getUsers);
router.post("/users", auth, checkRole([1]), createUser);
router.delete("/users/:id", auth, checkRole([1]), deleteUser);
router.put("/users/role/:id", auth, checkRole([1]), toggleRole);
router.put("/users/block/:id", auth, checkRole([1]), toggleBlock);

// ---- LOGS ----
router.get("/logs", auth, checkRole([1]), getLogs);

export default router;
