const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const conversationSchema = new Schema({
  exchange: {
    type: Schema.Types.ObjectId,
    ref: "Request",
    required: true,
    unique: true
  },
  participants: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model("Conversation", conversationSchema);
