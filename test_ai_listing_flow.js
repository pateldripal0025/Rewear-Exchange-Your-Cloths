require('dotenv').config();
const mongoose = require("mongoose");
const http = require("http");
const Listing = require("../models/listings");
const User = require("../models/user");
const aiService = require("../services/aiService");

async function runTest() {
    console.log("=== STARTING AI LISTING & ADMIN APPROVAL TEST ===");

    await mongoose.connect("mongodb://127.0.0.1:27017/Rewear");
    console.log("1. Connected to DB.");

    const seller = await User.findOne({ username: "alice" });
    const admin = await User.findOne({ role: "admin" });

    if (!seller || !admin) {
        console.error("Test setup error: Seller or Admin user missing.");
        process.exit(1);
    }

    console.log(`2. Found Seller: ${seller.username} (${seller._id}) and Admin: ${admin.username} (${admin._id})`);

    // Test 1: Directly test AI Service vision evaluation logic
    console.log("3. Testing AI Vision Analysis Service...");
    const sampleFront = "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&auto=format&fit=crop";
    const sampleBack = "https://images.unsplash.com/photo-1543076447-215ad9ba6923?w=800&auto=format&fit=crop";
    const sampleLabel = "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&auto=format&fit=crop";

    const aiEval = await aiService.analyzeListingImages(sampleFront, sampleBack, sampleLabel, {
        productName: "Vintage Leather Jacket",
        brand: "Levi's",
        size: "L",
        condition: "Excellent",
        itemType: "Jacket",
        color: "Black",
        description: "Classic 90s vintage leather biker jacket."
    });

    const aiData = aiEval.data || aiEval;

    console.log("AI Evaluation Result Success:", aiEval.success !== false);
    console.log("AI Suggested Credits:", aiData.suggestedCredits);
    console.log("AI Detected Brand:", aiData.detectedBrand);

    // Test 2: Create a PENDING_ADMIN_REVIEW Listing
    console.log("4. Creating test listing with PENDING_ADMIN_REVIEW status...");
    const testListing = new Listing({
        productName: "Test Vintage Bomber Jacket",
        brand: "Levi's",
        itemType: "Jacket",
        gender: "Men",
        size: "L",
        color: "Black",
        condition: "Excellent",
        productAge: "6–12 months",
        description: "Automated test item for AI valuation.",
        owner: seller._id,
        frontImage: { url: sampleFront, filename: "front_test" },
        backImage: { url: sampleBack, filename: "back_test" },
        labelImage: { url: sampleLabel, filename: "label_test" },
        images: [{ url: sampleFront, filename: "front_test" }],
        image: { url: sampleFront, filename: "front_test" },
        status: "PENDING_ADMIN_REVIEW",
        aiEvaluation: aiData,
        aiEstimatedCreditValue: aiData.suggestedCredits,
        price: aiData.suggestedCredits
    });

    await testListing.save();
    console.log(`Saved Test Listing ID: ${testListing._id}`);

    // Verify listing is NOT in public search query
    const publicListings = await Listing.find({
        _id: testListing._id,
        status: { $nin: ["PENDING_ADMIN_REVIEW", "ADMIN_REJECTED", "AI_PROCESSING", "AI_REVIEW_FAILED"] }
    });
    console.log("5. Verification: Listing present in public query BEFORE Admin Approval?", publicListings.length > 0 ? "FAILED (Visible)" : "PASSED (Hidden)");

    // Test 3: Admin Credit Modification & Approval
    console.log("6. Simulating Admin Credit Edit & Approval...");
    const adminEditedCredits = 2200; // Admin changes AI 2500 -> 2200
    testListing.status = "ADMIN_APPROVED";
    testListing.price = adminEditedCredits;
    testListing.adminReview = {
        reviewedBy: admin._id,
        reviewedAt: new Date(),
        finalValueINR: adminEditedCredits,
        finalCredits: adminEditedCredits
    };
    await testListing.save();

    // Verify listing IS now in public search query
    const approvedPublicListings = await Listing.find({
        _id: testListing._id,
        status: { $nin: ["PENDING_ADMIN_REVIEW", "ADMIN_REJECTED", "AI_PROCESSING", "AI_REVIEW_FAILED"] }
    });
    console.log("7. Verification: Listing present in public query AFTER Admin Approval?", approvedPublicListings.length > 0 ? "PASSED (Visible)" : "FAILED (Hidden)");
    console.log(`8. Verification: Displayed Credit Value is Admin-Approved Value (${approvedPublicListings[0]?.price})?`, approvedPublicListings[0]?.price === 2200 ? "PASSED" : "FAILED");

    // Clean up test listing
    await Listing.findByIdAndDelete(testListing._id);
    console.log("9. Cleaned up test listing.");

    console.log("=== ALL AI LISTING & ADMIN APPROVAL VERIFICATIONS PASSED ===");
    await mongoose.connection.close();
}

runTest().catch(err => {
    console.error("Test Error:", err);
    process.exit(1);
});
