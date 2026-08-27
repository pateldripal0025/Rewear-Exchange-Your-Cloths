const { Server } = require("socket.io");
const mongoose = require("mongoose");
const Conversation = require("../models/conversation");
const Message = require("../models/message");
const Request = require("../models/request");
const User = require("../models/user");

let ioInstance = null;

async function resolveUser(userIdOrUsername) {
    if (!userIdOrUsername) return null;
    if (mongoose.Types.ObjectId.isValid(userIdOrUsername)) {
        const u = await User.findById(userIdOrUsername);
        if (u) return u;
    }
    return await User.findOne({ username: userIdOrUsername });
}

function initSocket(server, sessionMiddleware) {
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // Wrap session middleware for Socket.IO handshake context
    io.use((socket, next) => {
        const req = socket.request;
        const res = {};
        sessionMiddleware(req, res, () => {
            if (req.session && req.session.passport && req.session.passport.user) {
                socket.userId = req.session.passport.user;
                return next();
            }
            socket.userId = null;
            next();
        });
    });

    io.on("connection", (socket) => {

        // Join exchange room with strict participant authorization
        socket.on("join_exchange_room", async ({ exchangeId, userId }) => {
            const rawId = userId || socket.userId;
            const user = await resolveUser(rawId);

            if (!user) {
                return socket.emit("socket_error", { message: "Authentication required to join chat." });
            }

            try {
                const exchange = await Request.findById(exchangeId);
                if (!exchange) {
                    return socket.emit("socket_error", { message: "Exchange not found." });
                }

                const allowedStatuses = ["ADMIN_APPROVED", "CHAT_ACTIVE", "USER_A_ACCEPTED", "USER_B_ACCEPTED", "COMPLETED"];
                if (!allowedStatuses.includes(exchange.status)) {
                    return socket.emit("socket_error", { message: "Chat room is locked until ReWear Admin approves the exchange." });
                }

                const isAdmin = user.role === "admin";
                const isSender = exchange.sender.toString() === user._id.toString();
                const isReceiver = exchange.receiver.toString() === user._id.toString();

                if (!isSender && !isReceiver && !isAdmin) {
                    return socket.emit("socket_error", { message: "Unauthorized! You are not a participant in this exchange." });
                }

                const roomName = `exchange_${exchangeId}`;
                socket.join(roomName);
                socket.emit("joined_room", { room: roomName, exchangeId });
            } catch (err) {
                console.error("Socket join_exchange_room error:", err);
                socket.emit("socket_error", { message: "Failed to join exchange chat room." });
            }
        });

        // Handle live message sending
        socket.on("send_message", async ({ exchangeId, text, userId }) => {
            const rawId = userId || socket.userId;
            const user = await resolveUser(rawId);

            if (!user || !text || !text.trim()) return;

            try {
                const conversation = await Conversation.findOne({ exchange: exchangeId });
                if (!conversation) {
                    return socket.emit("socket_error", { message: "Chat conversation room not active." });
                }

                // Verify membership
                const isParticipant = conversation.participants.some(p => p.toString() === user._id.toString());
                const isAdmin = user.role === "admin";

                if (!isParticipant && !isAdmin) {
                    return socket.emit("socket_error", { message: "Unauthorized chat message sender." });
                }

                const messageDoc = new Message({
                    conversation: conversation._id,
                    sender: user._id,
                    text: text.trim()
                });
                await messageDoc.save();

                const populatedMsg = await Message.findById(messageDoc._id).populate("sender", "username email role");

                const roomName = `exchange_${exchangeId}`;
                io.to(roomName).emit("receive_message", {
                    _id: populatedMsg._id,
                    conversationId: conversation._id,
                    sender: {
                        _id: populatedMsg.sender._id.toString(),
                        username: populatedMsg.sender.username
                    },
                    text: populatedMsg.text,
                    createdAt: populatedMsg.createdAt
                });
            } catch (err) {
                console.error("Socket send_message error:", err);
                socket.emit("socket_error", { message: "Failed to process chat message." });
            }
        });

        socket.on("disconnect", () => {
            // Socket disconnected
        });
    });

    ioInstance = io;
    return io;
}

function getIO() {
    return ioInstance;
}

function broadcastStatusUpdate(exchangeId, payload) {
    if (ioInstance) {
        ioInstance.to(`exchange_${exchangeId}`).emit("exchange_status_updated", payload);
    }
}

module.exports = {
    initSocket,
    getIO,
    broadcastStatusUpdate
};
