const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const transactionSchema = new Schema({
  exchange: {
    type: Schema.Types.ObjectId,
    ref: "Request",
    default: null
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  listing: {
    type: Schema.Types.ObjectId,
    ref: "Listing",
    default: null
  },
  amount: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ["EXCHANGE_PAYMENT", "EXCHANGE_RECEIPT", "INITIAL_BONUS"],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Transaction", transactionSchema);
