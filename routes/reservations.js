import express from "express";
import auth from "../middleware/authMiddleware.js";
import { createReservation, getMyReservations } from "../controllers/reservationsController.js";

const router = express.Router();

// правильные REST маршруты
router.post("/", auth, createReservation);      // создание бронирования
router.get("/mine", auth, getMyReservations);   // мои бронирования

export default router;
