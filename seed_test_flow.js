require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user');
const Listing = require('../models/listings');

async function seedTestFlow() {
    await mongoose.connect('mongodb://127.0.0.1:27017/Rewear');
    console.log("Connected to DB for test flow seeding...");

    // Create or find User A (alice)
    let userA = await User.findOne({ username: 'alice' });
    if (!userA) {
        userA = new User({ username: 'alice', email: 'alice@gmail.com', points: 2000, role: 'user' });
        await User.register(userA, 'user123');
        console.log("Created user 'alice' (password: user123)");
    } else {
        userA.points = 2000;
        await userA.save();
    }

    // Create or find User B (bob)
    let userB = await User.findOne({ username: 'bob' });
    if (!userB) {
        userB = new User({ username: 'bob', email: 'bob@gmail.com', points: 1500, role: 'user' });
        await User.register(userB, 'user123');
        console.log("Created user 'bob' (password: user123)");
    } else {
        userB.points = 1500;
        await userB.save();
    }

    // Create a luxury test item for bob
    let testListing = await Listing.findOne({ productName: 'Silk Designer Trench Coat' });
    if (!testListing) {
        testListing = new Listing({
            productName: 'Silk Designer Trench Coat',
            brand: 'Burberry',
            itemType: 'Clothing',
            gender: 'Women',
            size: 'M',
            color: 'Beige',
            condition: 'Excellent',
            productAge: '6–12 months',
            description: 'Authenic silk trench coat in excellent condition. Perfect luxury outerwear.',
            price: 500,
            exchangeAvailable: true,
            owner: userB._id,
            image: {
                url: 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=800&q=80',
                filename: 'trench_coat'
            }
        });
        await testListing.save();
        console.log("Created test listing 'Silk Designer Trench Coat' owned by bob (Price: 500 PTS)");
    }

    console.log("Test flow data seeded successfully.");
    mongoose.connection.close();
}

seedTestFlow().catch(err => {
    console.error("Error seeding test flow:", err);
    mongoose.connection.close();
});
