const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const messageSchema = new Schema({
  conversation: {
    type: Schema.Types.ObjectId,
    ref: "Conversation",
    required: true,
    index: true
  },
  sender: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  text: {
    type: String,
    required: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Message", messageSchema);
