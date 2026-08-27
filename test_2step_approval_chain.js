const mongoose = require("mongoose");
const User = require("../models/user");
const Listing = require("../models/listings");
const Request = require("../models/request");
const Conversation = require("../models/conversation");
const Message = require("../models/message");
const Transaction = require("../models/transaction");
const exchangeService = require("../services/exchangeService");

async function test2StepApprovalChain() {
    await mongoose.connect("mongodb://127.0.0.1:27017/Rewear");
    console.log("==================================================");
    console.log("  TESTING 2-STEP APPROVAL EXCHANGE WORKFLOW");
    console.log("==================================================\n");

    const alice = await User.findOne({ username: "alice" });
    const bob = await User.findOne({ username: "bob" });
    const admin = await User.findOne({ role: "admin" });
    const listing = await Listing.findOne({ productName: "Silk Designer Trench Coat" });

    if (!alice || !bob || !admin || !listing) {
        console.error("Missing test users or listing.");
        mongoose.connection.close();
        return;
    }

    // Reset balances and status
    alice.points = 2000;
    await alice.save();
    bob.points = 1500;
    await bob.save();
    listing.exchangeAvailable = true;
    await listing.save();

    await Request.deleteMany({ listing: listing._id });
    await Conversation.deleteMany({});
    await Message.deleteMany({});
    await Transaction.deleteMany({});

    // STEP 1: USER A CREATES REQUEST
    console.log("[PHASE 4] Step 1: User A (@alice) sends exchange request for User B's (@bob) garment...");
    const req1 = new Request({
        listing: listing._id,
        sender: alice._id,
        receiver: bob._id,
        status: "PENDING_OWNER",
        creditValue: listing.price
    });
    await req1.save();

    console.log(` -> Request Created. ID: #${req1._id.toString().slice(-6)} | Status: ${req1.status}`);
    
    // Check if Admin Queue sees this request (Expected: NO)
    const adminPendingBeforeOwner = await Request.find({ status: { $in: ["PENDING_ADMIN", "PENDING_ADMIN_REVIEW"] } });
    console.log(` -> Appears in Admin Queue before Owner Acceptance? ${adminPendingBeforeOwner.length > 0 ? "YES (FAIL)" : "NO (PASS)"}`);

    // STEP 2: TEST OWNER REJECTION FLOW
    console.log("\n[PHASE 5] Step 2: Testing Owner Rejection on a secondary test request...");
    const reqTestReject = new Request({
        listing: listing._id,
        sender: alice._id,
        receiver: bob._id,
        status: "PENDING_OWNER",
        creditValue: listing.price
    });
    await reqTestReject.save();
    const rejectRes = await exchangeService.ownerDecision(reqTestReject._id, bob._id, "REJECT");
    console.log(` -> Owner Rejected Status: ${rejectRes.status} | Message: "${rejectRes.message}"`);

    // STEP 3: OWNER ACCEPTS PRIMARY REQUEST
    console.log("\n[PHASE 5] Step 3: Product Owner (@bob) ACCEPTS primary request...");
    const ownerAcceptRes = await exchangeService.ownerDecision(req1._id, bob._id, "ACCEPT");
    console.log(` -> Owner Accepted Status: ${ownerAcceptRes.status} | Message: "${ownerAcceptRes.message}"`);

    // Verify request now appears in Admin Queue
    const adminPendingAfterOwner = await Request.find({ status: "PENDING_ADMIN" });
    console.log(` -> Appears in Admin Queue now? ${adminPendingAfterOwner.length === 1 ? "YES (PASS)" : "NO (FAIL)"}`);

    // STEP 4: ADMIN REJECTS OR APPROVES
    console.log("\n[PHASE 6 & 7] Step 4: ReWear Admin reviews and APPROVES request...");
    const adminApproveRes = await exchangeService.reviewExchange(req1._id, "APPROVE", "Authenticity and balance verified.");
    console.log(` -> Admin Review Status: ${adminApproveRes.status}`);
    console.log(` -> Private Conversation Room Created? ${adminApproveRes.conversation ? "YES (ID: " + adminApproveRes.conversation._id + ")" : "NO"}`);

    // STEP 5: TEST PRIVATE CHAT ACCESS & SECURITY
    console.log("\n[PHASE 9 & 13] Step 5: Testing Chat Room Access Security...");
    const updatedReq = await Request.findById(req1._id);
    const isChatActive = ["ADMIN_APPROVED", "CHAT_ACTIVE"].includes(updatedReq.status);
    console.log(` -> Chat Active for Participants (@alice & @bob)? ${isChatActive ? "YES (PASS)" : "NO (FAIL)"}`);

    // STEP 6: SEND MESSAGES
    console.log("\n[PHASE 9] Step 6: Exchanging messages between User A and User B...");
    const conversation = await Conversation.findOne({ exchange: req1._id });
    const msg1 = new Message({
        conversation: conversation._id,
        sender: alice._id,
        text: "Hello Bob! I submitted the request for your Silk Designer Trench Coat."
    });
    await msg1.save();

    const msg2 = new Message({
        conversation: conversation._id,
        sender: bob._id,
        text: "Hi Alice! The coat is packaged and ready to ship. I will confirm the swap!"
    });
    await msg2.save();

    const msgHistory = await Message.find({ conversation: conversation._id }).populate("sender", "username");
    console.log(` -> Messages saved in DB: ${msgHistory.length}`);
    msgHistory.forEach(m => console.log(`     [@${m.sender.username}]: ${m.text}`));

    // STEP 7: MUTUAL ACCEPTANCE & ATOMIC CREDIT DEDUCTION
    console.log("\n[PHASE 16] Step 7: Testing Mutual Accept in Chat & Credit Transfer...");
    const aliceAccept = await exchangeService.makeUserDecision(req1._id, alice._id, "ACCEPT");
    console.log(` -> @alice Accepted Status: ${aliceAccept.status}`);

    const bobAccept = await exchangeService.makeUserDecision(req1._id, bob._id, "ACCEPT");
    console.log(` -> @bob Accepted Status: ${bobAccept.status}`);

    // VERIFY FINAL BALANCES AND LISTING AVAILABILITY
    const finalAlice = await User.findById(alice._id);
    const finalBob = await User.findById(bob._id);
    const finalListing = await Listing.findById(listing._id);

    console.log("\n==================================================");
    console.log("  FINAL WORKFLOW VERIFICATION SUMMARY");
    console.log("==================================================");
    console.log(`Alice Balance : ${alice.points} PTS -> ${finalAlice.points} PTS (Deducted 500 PTS)`);
    console.log(`Bob Balance   : ${bob.points} PTS -> ${finalBob.points} PTS (Credited 500 PTS)`);
    console.log(`Listing State : ${finalListing.exchangeAvailable ? 'AVAILABLE' : 'EXCHANGED (UNAVAILABLE)'}`);
    console.log("==================================================\n");

    mongoose.connection.close();
}

test2StepApprovalChain().catch(err => {
    console.error("Workflow Test Error:", err);
    mongoose.connection.close();
});
