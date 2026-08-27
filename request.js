const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const requestSchema = new Schema({
  listing: {
    type: Schema.Types.ObjectId,
    ref: "Listing",
    required: true
  },
  sender: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  receiver: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  status: {
    type: String,
    enum: [
      "PENDING_OWNER",
      "OWNER_REJECTED",
      "PENDING_ADMIN",
      "ADMIN_REJECTED",
      "ADMIN_APPROVED",
      "CHAT_ACTIVE",
      "USER_A_ACCEPTED",
      "USER_B_ACCEPTED",
      "USER_A_REJECTED",
      "USER_B_REJECTED",
      "COMPLETED",
      "CANCELLED",
      // Legacy compatibility
      "PENDING_ADMIN_REVIEW",
      "pending",
      "accepted",
      "rejected"
    ],
    default: "PENDING_OWNER"
  },
  adminDecision: {
    type: String,
    enum: ["PENDING", "APPROVED", "REJECTED"],
    default: "PENDING"
  },
  senderDecision: {
    type: String,
    enum: ["PENDING", "ACCEPTED", "REJECTED"],
    default: "PENDING"
  },
  receiverDecision: {
    type: String,
    enum: ["PENDING", "ACCEPTED", "REJECTED"],
    default: "PENDING"
  },
  creditValue: {
    type: Number,
    default: 0
  },
  adminNotes: {
    type: String,
    default: ""
  },
  ownerApprovedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Request", requestSchema);
