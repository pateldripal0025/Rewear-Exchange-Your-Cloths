const mongoose = require("mongoose");
const Request = require("../models/request");
const Listing = require("../models/listings");
const User = require("../models/user");
const Conversation = require("../models/conversation");
const Transaction = require("../models/transaction");

/**
 * Product Owner (User B) ACCEPT or REJECT decision
 */
async function ownerDecision(exchangeId, ownerUserId, decision) {
    const exchange = await Request.findById(exchangeId).populate("listing sender receiver");
    if (!exchange) {
        throw new Error("Exchange request not found.");
    }

    // Security check: req.user must be the receiver (product owner)
    if (!exchange.receiver._id.equals(ownerUserId)) {
        throw new Error("Unauthorized: Only the listing owner can respond to this request.");
    }

    if (exchange.status !== "PENDING_OWNER" && exchange.status !== "pending") {
        throw new Error(`Cannot respond to request in '${exchange.status}' state.`);
    }

    if (decision === "ACCEPT" || decision === "accept") {
        exchange.receiverDecision = "ACCEPTED";
        exchange.status = "PENDING_ADMIN";
        exchange.ownerApprovedAt = new Date();
        await exchange.save();

        return {
            success: true,
            status: "PENDING_ADMIN",
            message: "Owner accepted request. Sent to ReWear Admin for review.",
            exchange
        };
    } else if (decision === "REJECT" || decision === "reject") {
        exchange.receiverDecision = "REJECTED";
        exchange.status = "OWNER_REJECTED";
        await exchange.save();

        return {
            success: true,
            status: "OWNER_REJECTED",
            message: "Request declined.",
            exchange
        };
    } else {
        throw new Error("Invalid decision action. Must be 'ACCEPT' or 'REJECT'.");
    }
}

/**
 * Admin APPROVE or REJECT an exchange request (Prerequisite: Owner must have accepted)
 */
async function reviewExchange(exchangeId, action, adminNotes = "") {
    const exchange = await Request.findById(exchangeId).populate("listing sender receiver");
    if (!exchange) {
        throw new Error("Exchange request not found.");
    }

    if (exchange.status !== "PENDING_ADMIN" && exchange.status !== "PENDING_ADMIN_REVIEW" && exchange.status !== "pending") {
        throw new Error(`Cannot review request in '${exchange.status}' state. Owner approval is required first.`);
    }

    if (action === "APPROVE") {
        exchange.adminDecision = "APPROVED";
        exchange.status = "ADMIN_APPROVED";
        exchange.senderDecision = "PENDING";
        exchange.receiverDecision = "PENDING";
        exchange.adminNotes = adminNotes;
        if (!exchange.creditValue && exchange.listing) {
            exchange.creditValue = exchange.listing.price || 0;
        }
        await exchange.save();

        // Create or get private conversation room
        let conversation = await Conversation.findOne({ exchange: exchange._id });
        if (!conversation) {
            conversation = new Conversation({
                exchange: exchange._id,
                participants: [exchange.sender._id, exchange.receiver._id]
            });
            await conversation.save();
        }

        return { success: true, status: "ADMIN_APPROVED", exchange, conversation };
    } else if (action === "REJECT") {
        exchange.adminDecision = "REJECTED";
        exchange.status = "ADMIN_REJECTED";
        exchange.adminNotes = adminNotes;
        await exchange.save();

        return { success: true, status: "ADMIN_REJECTED", exchange };
    } else {
        throw new Error("Invalid review action. Must be 'APPROVE' or 'REJECT'.");
    }
}

/**
 * User ACCEPT or REJECT decision inside chat
 */
async function makeUserDecision(exchangeId, userId, decision) {
    const exchange = await Request.findById(exchangeId).populate("listing sender receiver");
    if (!exchange) {
        throw new Error("Exchange request not found.");
    }

    // Security check: must be admin approved and not already terminated/completed
    const activeStates = ["ADMIN_APPROVED", "CHAT_ACTIVE", "USER_A_ACCEPTED", "USER_B_ACCEPTED"];
    if (!activeStates.includes(exchange.status)) {
        if (exchange.status === "COMPLETED") {
            return { success: true, status: "COMPLETED", message: "Exchange is already completed." };
        }
        if (exchange.status === "CANCELLED" || exchange.status === "ADMIN_REJECTED" || exchange.status === "OWNER_REJECTED") {
            throw new Error(`Exchange is no longer active (Status: ${exchange.status}).`);
        }
        throw new Error("Exchange has not been approved by Admin yet.");
    }

    const userIdStr = userId.toString();
    const isSender = exchange.sender._id.toString() === userIdStr;
    const isReceiver = exchange.receiver._id.toString() === userIdStr;

    if (!isSender && !isReceiver) {
        throw new Error("Unauthorized participant.");
    }

    if (decision === "REJECT" || decision === "reject") {
        if (isSender) exchange.senderDecision = "REJECTED";
        if (isReceiver) exchange.receiverDecision = "REJECTED";
        exchange.status = "CANCELLED";
        await exchange.save();

        return {
            success: true,
            status: "CANCELLED",
            message: "Exchange has been cancelled. No credits were transferred.",
            exchange
        };
    }

    if (decision === "ACCEPT" || decision === "accept") {
        if (isSender) exchange.senderDecision = "ACCEPTED";
        if (isReceiver) exchange.receiverDecision = "ACCEPTED";

        const bothAccepted = exchange.senderDecision === "ACCEPTED" && exchange.receiverDecision === "ACCEPTED";

        if (!bothAccepted) {
            if (isSender) exchange.status = "USER_A_ACCEPTED";
            if (isReceiver) exchange.status = "USER_B_ACCEPTED";
            await exchange.save();

            return {
                success: true,
                status: exchange.status,
                message: "You have accepted the exchange. Waiting for the other user.",
                exchange
            };
        }

        // Save decisions before execution
        await exchange.save();

        // Both accepted -> Execute Atomic Credit Deduction & Complete Exchange!
        const result = await executeAtomicCreditDeduction(exchange._id);
        return result;
    }

    throw new Error("Invalid decision value.");
}

/**
 * Perform Atomic, Idempotent Credit Transaction & Finalize Exchange
 */
async function executeAtomicCreditDeduction(exchangeId) {
    const exchange = await Request.findById(exchangeId).populate("listing sender receiver");
    if (!exchange) {
        throw new Error("Exchange record not found.");
    }

    // Idempotency check: if already completed, do not re-process
    if (exchange.status === "COMPLETED") {
        return {
            success: true,
            alreadyCompleted: true,
            status: "COMPLETED",
            message: "Exchange is already completed.",
            exchange
        };
    }

    if (exchange.senderDecision !== "ACCEPTED" || exchange.receiverDecision !== "ACCEPTED") {
        throw new Error("Both participants must accept before credit deduction.");
    }

    const requiredCredits = exchange.creditValue || exchange.listing?.price || 0;

    const listingId = (exchange.listing && exchange.listing._id) ? exchange.listing._id : exchange.listing;

    // 1. ATOMIC LISTING LOCK: Atomically claim listing availability to prevent race conditions
    const claimedListing = await Listing.findOneAndUpdate(
        { _id: listingId, exchangeAvailable: true },
        { $set: { exchangeAvailable: false } },
        { new: true }
    );

    if (!claimedListing) {
        // Listing is already locked or unavailable
        exchange.status = "CANCELLED";
        await exchange.save();
        throw new Error("This item is no longer available for exchange or has already been claimed in another transaction.");
    }

    // 2. ATOMIC CREDIT DEDUCTION: Verify and deduct credits from Requester (User A)
    if (requiredCredits > 0) {
        const updateRequester = await User.updateOne(
            { _id: exchange.sender._id, points: { $gte: requiredCredits } },
            { $inc: { points: -requiredCredits } }
        );

        if (updateRequester.modifiedCount === 0) {
            // Rollback listing availability lock if credit deduction fails!
            await Listing.updateOne({ _id: listingId }, { $set: { exchangeAvailable: true } });
            throw new Error(`Insufficient credits. Requester @${exchange.sender.username} has insufficient funds for this ${requiredCredits} PTS exchange.`);
        }

        // 3. ATOMIC CREDIT TRANSFER: Credit Listing Owner (User B)
        await User.updateOne(
            { _id: exchange.receiver._id },
            { $inc: { points: requiredCredits } }
        );

        // 4. Create Auditable Credit Transaction Records
        await Transaction.create([
            {
                exchange: exchange._id,
                user: exchange.sender._id,
                listing: exchange.listing._id,
                amount: -requiredCredits,
                type: "EXCHANGE_PAYMENT",
                description: `Exchanged '${claimedListing.productName}' with @${exchange.receiver.username}`
            },
            {
                exchange: exchange._id,
                user: exchange.receiver._id,
                listing: exchange.listing._id,
                amount: requiredCredits,
                type: "EXCHANGE_RECEIPT",
                description: `Received credits for '${claimedListing.productName}' from @${exchange.sender.username}`
            }
        ]);
    }

    // 5. Complete Exchange
    exchange.status = "COMPLETED";
    exchange.completedAt = new Date();
    await exchange.save();

    return {
        success: true,
        status: "COMPLETED",
        message: "Exchange completed successfully! Credits transferred.",
        exchange
    };
}

module.exports = {
    ownerDecision,
    reviewExchange,
    makeUserDecision,
    executeAtomicCreditDeduction
};
