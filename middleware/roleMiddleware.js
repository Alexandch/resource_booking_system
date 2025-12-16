export default function (roles = []) {
    return function (req, res, next) {
        if (!roles.includes(req.user.role_id)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        next();
    };
}
