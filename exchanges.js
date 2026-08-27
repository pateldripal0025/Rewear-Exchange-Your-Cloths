const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isExchangeParticipant } = require("../middleware");
const Request = require("../models/request");
const Conversation = require("../models/conversation");
const Message = require("../models/message");
const exchangeService = require("../services/exchangeService");
const { broadcastStatusUpdate } = require("../services/socketService");

// Render Private Exchange Chat & Decision Page
router.get("/:id/chat", isExchangeParticipant, wrapAsync(async (req, res) => {
    const { id } = req.params;
    const exchange = await Request.findById(id).populate("sender receiver listing");

    if (!exchange) {
        req.flash("error", "Exchange request not found.");
        return res.redirect("/dashboard");
    }

    // Only allow chat access if admin has approved (or in active/completed decision stages)
    const allowedStates = [
        "ADMIN_APPROVED",
        "USER_A_ACCEPTED",
        "USER_B_ACCEPTED",
        "COMPLETED",
        "CANCELLED",
        "USER_A_REJECTED",
        "USER_B_REJECTED"
    ];

    if (!allowedStates.includes(exchange.status)) {
        req.flash("error", "Chat is locked until Admin approves the exchange request.");
        return res.redirect("/dashboard");
    }

    // Find or create conversation room
    let conversation = await Conversation.findOne({ exchange: id });
    if (!conversation) {
        conversation = new Conversation({
            exchange: id,
            participants: [exchange.sender._id, exchange.receiver._id]
        });
        await conversation.save();
    }

    const messages = await Message.find({ conversation: conversation._id })
        .populate("sender", "username email role")
        .sort({ createdAt: 1 });

    const isSender = exchange.sender._id.toString() === req.user._id.toString();
    const isReceiver = exchange.receiver._id.toString() === req.user._id.toString();
    const myDecision = isSender ? exchange.senderDecision : (isReceiver ? exchange.receiverDecision : "PENDING");
    const otherDecision = isSender ? exchange.receiverDecision : (isReceiver ? exchange.senderDecision : "PENDING");
    const otherUser = isSender ? exchange.receiver : exchange.sender;

    res.render("exchanges/chat", {
        exchange,
        conversation,
        messages,
        isSender,
        isReceiver,
        myDecision,
        otherDecision,
        otherUser
    });
}));

// User Decision (ACCEPT / REJECT) inside chat
router.post("/:id/decision", isExchangeParticipant, wrapAsync(async (req, res) => {
    const { id } = req.params;
    const { decision } = req.body;

    try {
        const result = await exchangeService.makeUserDecision(id, req.user._id, decision);

        broadcastStatusUpdate(id, {
            status: result.status,
            message: result.message
        });

        req.flash("success", result.message);
    } catch (err) {
        console.error("Decision error:", err);
        req.flash("error", err.message || "Failed to process decision.");
    }

    res.redirect(`/exchanges/${id}/chat`);
}));

// JSON API Fallback to Fetch Messages
router.get("/api/:id/messages", isExchangeParticipant, wrapAsync(async (req, res) => {
    const { id } = req.params;
    const conversation = await Conversation.findOne({ exchange: id });
    if (!conversation) {
        return res.json([]);
    }

    const messages = await Message.find({ conversation: conversation._id })
        .populate("sender", "username")
        .sort({ createdAt: 1 });

    res.json(messages);
}));

// POST Send Chat Message (HTTP API + Socket broadcast)
router.post("/api/:id/messages", isExchangeParticipant, wrapAsync(async (req, res) => {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
        return res.status(400).json({ error: "Message text cannot be empty." });
    }

    const exchange = await Request.findById(id);
    if (!exchange) {
        return res.status(404).json({ error: "Exchange request not found." });
    }

    let conversation = await Conversation.findOne({ exchange: id });
    if (!conversation) {
        conversation = new Conversation({
            exchange: id,
            participants: [exchange.sender, exchange.receiver]
        });
        await conversation.save();
    }

    const messageDoc = new Message({
        conversation: conversation._id,
        sender: req.user._id,
        text: text.trim()
    });
    await messageDoc.save();

    const populatedMsg = await Message.findById(messageDoc._id).populate("sender", "username email role");

    // Broadcast over Socket.IO if available
    try {
        const { getIO } = require("../services/socketService");
        const io = getIO();
        if (io) {
            io.to(`exchange_${id}`).emit("receive_message", {
                _id: populatedMsg._id,
                conversationId: conversation._id,
                sender: {
                    _id: populatedMsg.sender._id.toString(),
                    username: populatedMsg.sender.username
                },
                text: populatedMsg.text,
                createdAt: populatedMsg.createdAt
            });
        }
    } catch (e) {
        console.error("Socket broadcast error:", e);
    }

    res.json({
        success: true,
        message: {
            _id: populatedMsg._id,
            conversationId: conversation._id,
            sender: {
                _id: populatedMsg.sender._id.toString(),
                username: populatedMsg.sender.username
            },
            text: populatedMsg.text,
            createdAt: populatedMsg.createdAt
        }
    });
}));

module.exports = router;
