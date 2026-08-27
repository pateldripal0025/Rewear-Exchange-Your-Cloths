const net = require('net');
const path = require('path');

function isPortOpen(port, host = '127.0.0.1') {
    return new Promise((resolve) => {
        const client = new net.Socket();
        client.setTimeout(1500);
        client.connect(port, host, () => {
            client.destroy();
            resolve(true);
        });
        client.on('error', () => {
            client.destroy();
            resolve(false);
        });
        client.on('timeout', () => {
            client.destroy();
            resolve(false);
        });
    });
}

async function start() {
    let mongoUri = "mongodb://127.0.0.1:27017/Rewear";
    const portOpen = await isPortOpen(27017);

    if (portOpen) {
        console.log("Found active MongoDB on 127.0.0.1:27017");
    } else {
        console.log("Local MongoDB not detected on 27017. Starting MongoMemoryServer (MongoDB 6.0)...");
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongod = await MongoMemoryServer.create({
            binary: {
                version: '6.0.14'
            },
            instance: {
                port: 27017,
                dbName: "Rewear"
            }
        });
        mongoUri = "mongodb://127.0.0.1:27017/Rewear";
        console.log("MongoMemoryServer started successfully at:", mongoUri);
    }

    process.env.MONGODB_URI = mongoUri;

    // Check if database needs seeding
    const mongoose = require('mongoose');
    await mongoose.connect(mongoUri);
    const User = require('./models/user');
    const Listing = require('./models/listings');

    const userCount = await User.countDocuments();
    const listingCount = await Listing.countDocuments();

    if (userCount === 0 || listingCount === 0) {
        console.log("Database is empty or missing seed data. Running automatic seeding...");
        const seedData = require('./init/seed_5_demo_items.js');
        await seedData();
    } else {
        console.log(`Database already populated (${userCount} users, ${listingCount} listings).`);
    }

    console.log("Starting ReWear Application server...");
    require('./app.js');
}

start().catch(err => {
    console.error("Failed to start ReWear application:", err);
    process.exit(1);
});
