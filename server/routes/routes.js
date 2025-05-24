const router = require("express").Router();
const {
  registerUser,
  loginUser,
  getProfile,
} = require("../controllers/user.controller");

const { protect } = require("../middleware/auth");

// Public routes
router.post("/register", registerUser); // Remove /user prefix
router.post("/login", loginUser); // Remove /user prefix

// Protected routes
router.get("/profile", protect, getProfile); // Remove /user prefix

module.exports = router;
