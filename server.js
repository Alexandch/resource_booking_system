import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

import authRoutes from "./routes/auth.js";
import resourcesRoutes from "./routes/resources.js";
import reservationsRoutes from "./routes/reservations.js";
import adminRoutes from "./routes/admin.js";
import notificationsRoutes from "./routes/notifications.js";

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// маршруты
app.use("/api/auth", authRoutes);
app.use("/api/resources", resourcesRoutes);
app.use("/api/reservations", reservationsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationsRoutes);

app.listen(3000, () => {
    console.log("Server running on port 3000");
});
