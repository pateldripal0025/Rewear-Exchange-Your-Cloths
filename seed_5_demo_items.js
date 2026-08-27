const mongoose = require("mongoose");
const User = require("../models/user");
const Listing = require("../models/listings");
const Request = require("../models/request");
const Conversation = require("../models/conversation");
const Message = require("../models/message");
const Transaction = require("../models/transaction");

async function seedData() {
    const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/Rewear";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB for clean database seeding...");

    // 1. Wipe all existing collections
    await Request.deleteMany({});
    await Conversation.deleteMany({});
    await Message.deleteMany({});
    await Transaction.deleteMany({});
    await Listing.deleteMany({});
    await User.deleteMany({});
    console.log("Cleared all existing database collections.");

    // 2. Create Users
    const adminUser = new User({
        username: "admin",
        email: "admin@rewear.com",
        role: "admin",
        points: 10000
    });
    await User.register(adminUser, "adminpassword123");

    const demoUser = new User({
        username: "demo",
        email: "demo@gmail.com",
        role: "user",
        points: 2500
    });
    await User.register(demoUser, "abc@123");

    const aliceUser = new User({
        username: "alice",
        email: "alice@rewear.com",
        role: "user",
        points: 2000
    });
    await User.register(aliceUser, "password123");

    const bobUser = new User({
        username: "bob",
        email: "bob@rewear.com",
        role: "user",
        points: 1500
    });
    await User.register(bobUser, "password123");

    console.log("Seeded Users: admin, demo, alice, bob");

    // 3. Define 5 High Quality Demo Items with 3 Images Each
    const listingsData = [
        {
            productName: "Vintage Italian Leather Biker Jacket",
            brand: "AllSaints",
            category: "Outerwear",
            itemType: "Jacket",
            gender: "Men",
            size: "L",
            color: "Midnight Black",
            material: "100% Genuine Italian Calfskin",
            condition: "Excellent",
            productAge: "6–12 months",
            price: 650,
            exchangeAvailable: true,
            owner: demoUser._id,
            description: "Hand-finished black leather biker jacket with asymmetrical silver zips and quilted shoulders. Timeless piece with subtle patina.",
            preferredItems: "Designer Denim, Cashmere Sweaters",
            additionalNotes: "Includes original dust cover. Non-smoking home.",
            images: [
                { url: "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1000&q=80", filename: "biker_jacket_1" },
                { url: "https://images.unsplash.com/photo-1521223890158-f9f7c3d5d504?auto=format&fit=crop&w=1000&q=80", filename: "biker_jacket_2" },
                { url: "https://images.unsplash.com/photo-1520975954732-35dd22299614?auto=format&fit=crop&w=1000&q=80", filename: "biker_jacket_3" }
            ]
        },
        {
            productName: "Silk Minimalist Emerald Wrap Dress",
            brand: "Reformation",
            category: "Dresses",
            itemType: "Dress",
            gender: "Women",
            size: "M",
            color: "Emerald Green",
            material: "100% Mulberry Silk",
            condition: "Like New",
            productAge: "Less than 6 months",
            price: 420,
            exchangeAvailable: true,
            owner: aliceUser._id,
            description: "Elegant emerald green silk wrap dress with a subtle V-neckline and fluid movement. Flattering fit with adjustable waist tie.",
            preferredItems: "Tailored Blazers, Trench Coats",
            additionalNotes: "Worn once to an evening gala. Professionally dry-cleaned.",
            images: [
                { url: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=1000&q=80", filename: "emerald_dress_1" },
                { url: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1000&q=80", filename: "emerald_dress_2" },
                { url: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=80", filename: "emerald_dress_3" }
            ]
        },
        {
            productName: "Oversized Camel Wool Trench Coat",
            brand: "Acne Studios",
            category: "Coats",
            itemType: "Coat",
            gender: "Unisex",
            size: "XL",
            color: "Camel Tan",
            material: "90% Virgin Wool, 10% Cashmere",
            condition: "New with Tags",
            productAge: "Less than 6 months",
            price: 850,
            exchangeAvailable: true,
            owner: bobUser._id,
            description: "Structured double-breasted wool trench coat in classic camel. Relaxed silhouette with belted waist and horn buttons.",
            preferredItems: "Leather Boots, Minimalist Accessories",
            additionalNotes: "Brand new with original tags attached.",
            images: [
                { url: "https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=1000&q=80", filename: "trench_coat_1" },
                { url: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=1000&q=80", filename: "trench_coat_2" },
                { url: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1000&q=80", filename: "trench_coat_3" }
            ]
        },
        {
            productName: "Retro Japanese Selvedge Denim Jacket",
            brand: "Levi's Vintage Clothing",
            category: "Outerwear",
            itemType: "Jacket",
            gender: "Men",
            size: "M",
            color: "Indigo Wash",
            material: "100% Selvedge Cotton Denim",
            condition: "Good",
            productAge: "1–2 years",
            price: 380,
            exchangeAvailable: true,
            owner: demoUser._id,
            description: "Authentic 14oz Japanese selvedge denim jacket featuring custom brass buttons, contrast stitching, and subtle fading.",
            preferredItems: "Graphic Tees, Utility Vests",
            additionalNotes: "Has vintage fading character near elbows.",
            images: [
                { url: "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=1000&q=80", filename: "denim_jacket_1" },
                { url: "https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=1000&q=80", filename: "denim_jacket_2" },
                { url: "https://images.unsplash.com/photo-1516257984-b1b4d707412e?auto=format&fit=crop&w=1000&q=80", filename: "denim_jacket_3" }
            ]
        },
        {
            productName: "Handcrafted Italian Cashmere Knit Sweater",
            brand: "Loro Piana",
            category: "Knitwear",
            itemType: "Sweater",
            gender: "Unisex",
            size: "S",
            color: "Oatmeal Beige",
            material: "100% Mongolian Cashmere",
            condition: "Excellent",
            productAge: "6–12 months",
            price: 520,
            exchangeAvailable: true,
            owner: aliceUser._id,
            description: "Ultra-soft ribbed crewneck cashmere sweater crafted in Northern Italy. Breathable, lightweight warmth with ribbed trim.",
            preferredItems: "Silk Scarves, Tailored Trousers",
            additionalNotes: "Stored with cedar blocks. Impeccable softness.",
            images: [
                { url: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=1000&q=80", filename: "cashmere_sweater_1" },
                { url: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=1000&q=80", filename: "cashmere_sweater_2" },
                { url: "https://images.unsplash.com/photo-1578587018452-892bacefd3f2?auto=format&fit=crop&w=1000&q=80", filename: "cashmere_sweater_3" }
            ]
        }
    ];

    for (let itemData of listingsData) {
        itemData.image = {
            url: itemData.images[0].url,
            filename: itemData.images[0].filename
        };
        itemData.status = "ADMIN_APPROVED";
        const listingDoc = new Listing(itemData);
        await listingDoc.save();
    }

    console.log("Successfully seeded 5 demo listings with 3 images each!");
}

module.exports = seedData;

if (require.main === module) {
    seedData()
        .then(() => mongoose.connection.close())
        .catch(err => {
            console.error("Seeding Error:", err);
            mongoose.connection.close();
        });
}
