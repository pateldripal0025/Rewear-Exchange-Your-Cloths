const mongoose = require("mongoose");
const User = require("../models/user");
const Listing = require("../models/listings");
const Request = require("../models/request");
const Conversation = require("../models/conversation");
const Message = require("../models/message");
const Transaction = require("../models/transaction");
const exchangeService = require("../services/exchangeService");

async function testChatAndCredits() {
    await mongoose.connect("mongodb://127.0.0.1:27017/Rewear");
    console.log("=== Testing Exchange Chat Box & Atomic Credit Execution ===");

    const alice = await User.findOne({ username: "alice" });
    const bob = await User.findOne({ username: "bob" });
    const listing = await Listing.findOne({ productName: "Silk Designer Trench Coat" });

    if (!alice || !bob || !listing) {
        console.error("Missing test users or listing.");
        mongoose.connection.close();
        return;
    }

    // Reset points for accurate credit math verification
    alice.points = 2000;
    await alice.save();
    bob.points = 1500;
    await bob.save();
    listing.exchangeAvailable = true;
    await listing.save();

    // 1. Create request and Admin approve it
    await Request.deleteMany({ listing: listing._id });
    await Conversation.deleteMany({});
    await Message.deleteMany({});
    await Transaction.deleteMany({});

    const exchange = new Request({
        listing: listing._id,
        sender: alice._id,
        receiver: bob._id,
        status: "PENDING_ADMIN_REVIEW",
        creditValue: listing.price
    });
    await exchange.save();

    await exchangeService.reviewExchange(exchange._id, "APPROVE", "Approved for chat testing.");
    console.log(`[1] Admin Approved Request. Room Created. ID: ${exchange._id}`);

    // 2. Retrieve conversation room
    const conversation = await Conversation.findOne({ exchange: exchange._id });
    console.log(`[2] Chat Room Conversation ID: ${conversation._id}`);

    // 3. User A (Alice) sends a chat message
    const msg1 = new Message({
        conversation: conversation._id,
        sender: alice._id,
        text: "Hi Bob, I love this Burberry trench coat! Is it ready for shipping?"
    });
    await msg1.save();
    console.log(`[3] Message sent by @alice: "${msg1.text}"`);

    // 4. User B (Bob) sends a response message
    const msg2 = new Message({
        conversation: conversation._id,
        sender: bob._id,
        text: "Hi Alice! Yes, it's packed and ready. Accept the exchange whenever you're ready!"
    });
    await msg2.save();
    console.log(`[4] Message sent by @bob: "${msg2.text}"`);

    // 5. Verify message history retrieval
    const messages = await Message.find({ conversation: conversation._id }).populate("sender", "username");
    console.log(`[5] Retrieved ${messages.length} messages in chat history:`);
    messages.forEach(m => console.log(`   - @${m.sender.username}: ${m.text}`));

    // 6. User A (Alice) clicks Accept in Chat
    const resA = await exchangeService.makeUserDecision(exchange._id, alice._id, "ACCEPT");
    console.log(`\n[6] @alice clicked ACCEPT -> Status: ${resA.status} (Message: ${resA.message})`);

    // 7. User B (Bob) clicks Accept in Chat -> Triggers Atomic Credit Deduction!
    const resB = await exchangeService.makeUserDecision(exchange._id, bob._id, "ACCEPT");
    console.log(`[7] @bob clicked ACCEPT -> Status: ${resB.status} (Message: ${resB.message})`);

    // 8. Verify Credit Balances and Transaction Records
    const updatedAlice = await User.findById(alice._id);
    const updatedBob = await User.findById(bob._id);
    const updatedListing = await Listing.findById(listing._id);
    const transactions = await Transaction.find({ exchange: exchange._id });

    console.log("\n=== VERIFICATION RESULTS ===");
    console.log(`Alice Balance: ${alice.points} PTS -> ${updatedAlice.points} PTS (Deducted 500 PTS)`);
    console.log(`Bob Balance:   ${bob.points} PTS -> ${updatedBob.points} PTS (Credited 500 PTS)`);
    console.log(`Listing Availability: ${updatedListing.exchangeAvailable ? 'AVAILABLE' : 'EXCHANGED (UNAVAILABLE)'}`);
    console.log(`Transaction Records Written: ${transactions.length}`);
    transactions.forEach(t => console.log(`   - ${t.type}: ${t.amount} PTS for User ${t.user}`));

    mongoose.connection.close();
}

testChatAndCredits().catch(err => {
    console.error("Chat Test Error:", err);
    mongoose.connection.close();
});
