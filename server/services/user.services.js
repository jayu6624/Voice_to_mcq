const userModel = require("../model/user.model");

module.exports.cerateUser = async ({
  firstname,
  lastname,
  email,
  phonenumber,
  password,
}) => {
  if (!firstname || !email || !password ||!phonenumber) {
    throw new Error("all feilds are required");
  }
  const user = await userModel.create({
    fullname: {
        firstname,
        lastname,
    },
    email,
    password,
    phonenumber
});
  return user;
};

