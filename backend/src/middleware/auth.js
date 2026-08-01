// src/middleware/auth.js
const jwt  = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "No token provided." });
  }

  const token = header.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id).select("name username").lean();
    if (!user) return res.status(401).json({ success: false, message: "User not found." });

    req.user = { id: decoded.id, name: user.name, username: user.username };
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired token." });
  }
};