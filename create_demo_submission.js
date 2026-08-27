require('dotenv').config();
const mongoose = require("mongoose");
const Listing = require("../models/listings");
const User = require("../models/user");
const aiService = require("../services/aiService");

async function createDemoSubmission() {
    await mongoose.connect("mongodb://127.0.0.1:27017/Rewear");
    console.log("Connected to MongoDB...");

    // Find a regular seller user
    let seller = await User.findOne({ role: { $ne: "admin" } });
    if (!seller) {
        seller = await User.findOne();
    }

    console.log(`Creating listing for seller: @${seller.username} (${seller._id})`);

    // High quality sample images for Front, Back, Label
    const frontImageUrl = "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=800&auto=format&fit=crop";
    const backImageUrl = "https://images.unsplash.com/photo-1543076447-215ad9ba6923?q=80&w=800&auto=format&fit=crop";
    const labelImageUrl = "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=800&auto=format&fit=crop";

    console.log("Invoking OpenAI Vision API for image analysis...");

    const aiEvalResult = await aiService.analyzeListingImages(
        frontImageUrl,
        backImageUrl,
        labelImageUrl,
        {
            productName: "Vintage Leather Biker Jacket",
            brand: "Levi's",
            size: "L",
            condition: "Excellent",
            itemType: "Jacket",
            color: "Dark Brown",
            material: "100% Genuine Leather",
            description: "Authentic heavy-grade vintage leather jacket with brass zipper hardware."
        }
    );

    const aiData = aiEvalResult.data || aiEvalResult;

    console.log("AI Vision Analysis Completed!");
    console.log("Detected Brand:", aiData.detectedBrand);
    console.log("Detected Size:", aiData.detectedSize);
    console.log("AI Suggested Value (INR): ₹" + aiData.estimatedValueINR);
    console.log("AI Suggested Credits:", aiData.suggestedCredits);

    const newListing = new Listing({
        productName: "Vintage Leather Biker Jacket",
        brand: "Levi's",
        category: "Jacket",
        itemType: "Jacket",
        gender: "Men",
        size: "L",
        color: "Dark Brown",
        material: "100% Genuine Leather",
        condition: "Excellent",
        productAge: "1–2 years",
        description: "Authentic heavy-grade vintage leather jacket with brass zipper hardware.",
        exchangeAvailable: true,
        preferredItems: "Denim Jackets, Hoodies",
        owner: seller._id,
        frontImage: { url: frontImageUrl, filename: "front_demo" },
        backImage: { url: backImageUrl, filename: "back_demo" },
        labelImage: { url: labelImageUrl, filename: "label_demo" },
        images: [
            { url: frontImageUrl, filename: "front_demo" },
            { url: backImageUrl, filename: "back_demo" },
            { url: labelImageUrl, filename: "label_demo" }
        ],
        image: { url: frontImageUrl, filename: "front_demo" },
        status: "PENDING_ADMIN_REVIEW",
        aiEvaluation: aiData,
        aiEstimatedCreditValue: aiData.suggestedCredits,
        price: aiData.suggestedCredits
    });

    await newListing.save();

    console.log("\n==================================================");
    console.log("SUCCESSFULLY CREATED NEW PRODUCT SUBMISSION!");
    console.log("--------------------------------------------------");
    console.log("Listing ID:", newListing._id);
    console.log("Product Name:", newListing.productName);
    console.log("Seller:", seller.username);
    console.log("Status:", newListing.status);
    console.log("AI Valuation:", aiData.suggestedCredits + " Credits");
    console.log("Admin Approval Queue URL: http://localhost:8080/admin/listings/review");
    console.log("==================================================\n");

    await mongoose.connection.close();
}

createDemoSubmission().catch(err => {
    console.error("Error creating demo submission:", err);
    process.exit(1);
});
