import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

export default function (req, res, next) {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(403).json({ message: "Unauthorized" });
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        return res.status(403).json({ message: "Unauthorized" });
    }
}
