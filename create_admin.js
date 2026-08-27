require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user');

async function seedAdmin() {
    await mongoose.connect('mongodb://127.0.0.1:27017/Rewear');
    console.log("Connected to DB for admin seeding...");

    const adminEmail = "admin@gmail.com";
    const adminUsername = "admin";

    let existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
        existingAdmin.role = "admin";
        if (!existingAdmin.points || existingAdmin.points < 5000) {
            existingAdmin.points = 10000;
        }
        await existingAdmin.save();
        console.log("Existing admin account updated to role='admin'. Username: admin");
    } else {
        const newAdmin = new User({
            username: adminUsername,
            email: adminEmail,
            role: "admin",
            points: 10000
        });

        await User.register(newAdmin, "admin123");
        console.log("New admin created! Email: admin@gmail.com | Password: admin123 | Role: admin");
    }

    mongoose.connection.close();
}

seedAdmin().catch(err => {
    console.error("Error seeding admin:", err);
    mongoose.connection.close();
});
