const mongoose = require("mongoose");
const User = require("../models/user");
const Listing = require("../models/listings");
const Request = require("../models/request");
const Conversation = require("../models/conversation");
const exchangeService = require("../services/exchangeService");

async function testFullFlow() {
    await mongoose.connect("mongodb://127.0.0.1:27017/Rewear");
    console.log("=== Testing End-to-End Exchange Flow & Chat Access ===");

    const alice = await User.findOne({ username: "alice" });
    const bob = await User.findOne({ username: "bob" });
    const admin = await User.findOne({ role: "admin" });
    const listing = await Listing.findOne({ productName: "Silk Designer Trench Coat" });

    if (!alice || !bob || !admin || !listing) {
        console.error("Missing test data.");
        mongoose.connection.close();
        return;
    }

    console.log(`User A (Requester): @${alice.username} (${alice.points} PTS)`);
    console.log(`User B (Owner): @${bob.username} (${bob.points} PTS)`);
    console.log(`Listing: '${listing.productName}' (${listing.price} PTS)`);

    // 1. Clean previous test requests for this listing
    await Request.deleteMany({ listing: listing._id });
    await Conversation.deleteMany({});

    // 2. User A sends exchange request
    const newReq = new Request({
        listing: listing._id,
        sender: alice._id,
        receiver: bob._id,
        status: "PENDING_ADMIN_REVIEW",
        creditValue: listing.price
    });
    await newReq.save();
    console.log(`\n[STEP 1] Request Created. Status: ${newReq.status}`);
    console.log(`Chat access allowed? ${["ADMIN_APPROVED", "USER_A_ACCEPTED", "USER_B_ACCEPTED", "COMPLETED"].includes(newReq.status)} (Expected: FALSE)`);

    // 3. Admin Reviews and Approves request
    const reviewResult = await exchangeService.reviewExchange(newReq._id, "APPROVE", "Verified authenticity.");
    console.log(`\n[STEP 2] Admin Approved Request. Status: ${reviewResult.status}`);
    console.log(`Chat Conversation Activated? ID: ${reviewResult.conversation._id}`);

    // 4. Verify User A now has Chat Access
    const updatedReq = await Request.findById(newReq._id);
    const hasChatAccess = ["ADMIN_APPROVED", "USER_A_ACCEPTED", "USER_B_ACCEPTED", "COMPLETED"].includes(updatedReq.status);
    console.log(`\n[STEP 3] User Chat Access Granted? ${hasChatAccess} (Expected: TRUE)`);

    mongoose.connection.close();
}

testFullFlow().catch(err => {
    console.error("Test Error:", err);
    mongoose.connection.close();
});
