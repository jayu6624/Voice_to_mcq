const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const userSchema = new mongoose.Schema(
  {
    fullname: {
      firstname: {
        type: String,
        required: true,
        minlength: [3, "first name must be at least 3 characters long"],
      },
      lastname: {
        type: String,
        minlength: [3, "last name must be at least 3 characters long"],
      },
    },
    email: {
      type: String,
      required: true,
      unique: true,
      minlength: [5, "Email must be at least 5 characters long "],
    },
    phonenumber: {
      type: String,
      unique: true,
      minlength: [10, "Phone number must be at least 10 characters long "],
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

// Fix method definitions (change method to methods)
//JWT token generation:
userSchema.methods.generateAuthToken = function () {
  const token = jwt.sign(
    { id: this._id, email: this.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" } // Token expires in 7 days
  );
  return token;
};

userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Fix static method and add password parameter
userSchema.statics.hashPassword = async function (password) {
  return bcrypt.hash(password, 10);
};

const userModel = mongoose.model("user", userSchema);
module.exports = userModel;
