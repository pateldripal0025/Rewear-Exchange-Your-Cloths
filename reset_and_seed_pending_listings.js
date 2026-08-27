require('dotenv').config();
const mongoose = require("mongoose");
const Listing = require("../models/listings");
const User = require("../models/user");
const aiService = require("../services/aiService");

const sampleListingsData = [
    {
        productName: "Vintage Italian Biker Jacket",
        brand: "AllSaints",
        category: "Jacket",
        itemType: "Jacket",
        gender: "Men",
        size: "L",
        color: "Washed Black",
        material: "100% Genuine Lambskin",
        condition: "Excellent",
        productAge: "1–2 years",
        description: "Heavyweight washed black Italian lambskin leather biker jacket with asymmetric metal zips.",
        preferredItems: "Denim Jackets, Boots",
        frontImage: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&auto=format&fit=crop",
        backImage: "https://images.unsplash.com/photo-1543076447-215ad9ba6923?w=800&auto=format&fit=crop",
        labelImage: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&auto=format&fit=crop"
    },
    {
        productName: "Silk Emerald Evening Wrap Dress",
        brand: "Reformation",
        category: "Dress",
        itemType: "Dress",
        gender: "Women",
        size: "M",
        color: "Emerald Green",
        material: "100% Mulberry Silk",
        condition: "Like New",
        productAge: "Less than 6 months",
        description: "Flowing floor-length emerald green silk wrap dress with subtle tie waist.",
        preferredItems: "Designer Bags, Heels",
        frontImage: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800&auto=format&fit=crop",
        backImage: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop",
        labelImage: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&auto=format&fit=crop"
    },
    {
        productName: "Oversized Camel Wool Trench Coat",
        brand: "Acne Studios",
        category: "Jacket",
        itemType: "Coat",
        gender: "Unisex",
        size: "XL",
        color: "Camel Tan",
        material: "90% Virgin Wool, 10% Cashmere",
        condition: "Excellent",
        productAge: "6–12 months",
        description: "Double-breasted oversized wool trench coat with classic storm flap and tortoiseshell buttons.",
        preferredItems: "Winter Sweaters, Leather Boots",
        frontImage: "https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop",
        backImage: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop",
        labelImage: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&auto=format&fit=crop"
    },
    {
        productName: "Japanese Selvedge Denim Trucker Jacket",
        brand: "Levi's Vintage Clothing",
        category: "Jacket",
        itemType: "Jacket",
        gender: "Men",
        size: "M",
        color: "Indigo Blue",
        material: "14oz Kaihara Selvedge Denim",
        condition: "Good",
        productAge: "1–2 years",
        description: "Raw indigo Japanese selvedge denim trucker jacket featuring redline selvedge ID detail.",
        preferredItems: "Flannel Shirts, Cargo Pants",
        frontImage: "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=800&auto=format&fit=crop",
        backImage: "https://images.unsplash.com/photo-1543076447-215ad9ba6923?w=800&auto=format&fit=crop",
        labelImage: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&auto=format&fit=crop"
    },
    {
        productName: "Handcrafted Italian Cashmere Knit Sweater",
        brand: "Loro Piana",
        category: "Sweater",
        itemType: "Sweater",
        gender: "Men",
        size: "L",
        color: "Cream White",
        material: "100% Baby Cashmere",
        condition: "Like New",
        productAge: "Less than 6 months",
        description: "Ultra-soft Italian cable knit crewneck sweater crafted from premium un-dyed baby cashmere.",
        preferredItems: "Tailored Trousers, Scarves",
        frontImage: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&auto=format&fit=crop",
        backImage: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop",
        labelImage: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&auto=format&fit=crop"
    }
];

async function resetAndSeedPending() {
    await mongoose.connect("mongodb://127.0.0.1:27017/Rewear");
    console.log("Connected to MongoDB...");

    // 1. Delete ALL existing listings
    const deleteResult = await Listing.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} old listings from DB.`);

    // Find users to assign as sellers
    const users = await User.find({ role: { $ne: "admin" } });
    if (users.length === 0) {
        console.error("No non-admin users found in database!");
        process.exit(1);
    }

    console.log(`Found ${users.length} seller user(s) to attach listings to.`);

    // 2. Create 5 new listings with AI Vision Evaluation in PENDING_ADMIN_REVIEW state
    for (let i = 0; i < sampleListingsData.length; i++) {
        const item = sampleListingsData[i];
        const seller = users[i % users.length];

        console.log(`\nEvaluating Item [${i + 1}/5]: "${item.productName}" for @${seller.username}...`);

        const aiEval = await aiService.analyzeListingImages(
            item.frontImage,
            item.backImage,
            item.labelImage,
            {
                productName: item.productName,
                brand: item.brand,
                size: item.size,
                condition: item.condition,
                itemType: item.itemType,
                color: item.color,
                material: item.material,
                description: item.description
            }
        );

        const aiData = aiEval.data || aiEval;

        const newListing = new Listing({
            productName: item.productName,
            brand: item.brand,
            category: item.category,
            itemType: item.itemType,
            gender: item.gender,
            size: item.size,
            color: item.color,
            material: item.material,
            condition: item.condition,
            productAge: item.productAge,
            description: item.description,
            exchangeAvailable: true,
            preferredItems: item.preferredItems,
            owner: seller._id,
            frontImage: { url: item.frontImage, filename: `front_seed_${i}` },
            backImage: { url: item.backImage, filename: `back_seed_${i}` },
            labelImage: { url: item.labelImage, filename: `label_seed_${i}` },
            images: [
                { url: item.frontImage, filename: `front_seed_${i}` },
                { url: item.backImage, filename: `back_seed_${i}` },
                { url: item.labelImage, filename: `label_seed_${i}` }
            ],
            image: { url: item.frontImage, filename: `front_seed_${i}` },
            status: "PENDING_ADMIN_REVIEW",
            aiEvaluation: aiData,
            aiEstimatedCreditValue: aiData.suggestedCredits || 2500,
            price: aiData.suggestedCredits || 2500
        });

        await newListing.save();

        console.log(`Saved Listing #${newListing._id.toString().slice(-6)}`);
        console.log(`  - Seller: @${seller.username}`);
        console.log(`  - AI Valuation: ₹${(aiData.estimatedValueINR || 2500).toLocaleString()} (${aiData.suggestedCredits || 2500} Credits)`);
        console.log(`  - Status: PENDING_ADMIN_REVIEW`);
    }

    console.log("\n==================================================");
    console.log("SUCCESSFULLY RESET ALL LISTINGS & ADDED 5 PENDING SUBMISSIONS!");
    console.log("--------------------------------------------------");
    console.log("Total Listings in DB: 5");
    console.log("All 5 listings are currently PENDING_ADMIN_REVIEW.");
    console.log("Open Admin Portal: http://localhost:8080/admin/dashboard");
    console.log("Open Approvals Queue: http://localhost:8080/admin/listings/review");
    console.log("==================================================\n");

    await mongoose.connection.close();
}

resetAndSeedPending().catch(err => {
    console.error("Error seeding pending listings:", err);
    process.exit(1);
});
