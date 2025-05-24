const { validationResult } = require("express-validator");
const userModel = require("../model/user.model");
const userService = require("../services/user.services");

module.exports.registerUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { fullname, email, password, phonenumber } = req.body;

    // Validate phone number if provided
    if (phonenumber && !/^\d{10}$/.test(phonenumber)) {
      return res.status(400).json({
        message:
          "Invalid phone number format. Please provide a 10-digit number.",
      });
    }

    // Check if user exists
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "User already exists. Please try logging in.",
      });
    }

    // Create new user
    const newUser = new userModel({
      fullname: {
        firstname: fullname.firstname,
        lastname: fullname.lastname,
      },
      email,
      phonenumber,
      password: await userModel.hashPassword(password),
    });

    await newUser.save();

    // Generate token
    const token = newUser.generateAuthToken();

    // Remove password from response
    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: userResponse,
    });
  } catch (error) {
    console.error("Error in registerUser:", error);
    res.status(500).json({
      success: false,
      message: "An unexpected error occurred. Please try again later.",
    });
  }
};

module.exports.loginUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { email, password } = req.body;

    // Find user and include password for verification
    const user = await userModel.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Generate token
    const token = user.generateAuthToken();

    // Set cookie and remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    // Set secure cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: userResponse,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred during login. Please try again.",
    });
  }
};

module.exports.getProfile = async (req, res, next) => {
  try {
    const user = await userModel.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        fullname: user.fullname,
        email: user.email,
        phonenumber: user.phonenumber,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Error in getProfile:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
