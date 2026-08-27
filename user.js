const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose").default;

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true
  },
  points: {
    type: Number,
    default: 0
  },
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user"
  },
  wishlist: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing"
    }
  ]
});

userSchema.plugin(passportLocalMongoose);
console.log(typeof passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);