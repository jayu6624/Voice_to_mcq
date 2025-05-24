const jwt = require("jsonwebtoken");
const userModel = require("../model/user.model");

exports.protect = async (req, res, next) => {
  try {
    // Get token from header or cookies
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Please log in.",
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      const user = await userModel.findById(decoded.id).select("-password");
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User no longer exists",
        });
      }

      // Check if token was issued after password change
      if (
        user.passwordChangedAt &&
        decoded.iat < user.passwordChangedAt.getTime() / 1000
      ) {
        return res.status(401).json({
          success: false,
          message: "Password recently changed. Please log in again",
        });
      }

      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Invalid token. Please log in again",
      });
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
