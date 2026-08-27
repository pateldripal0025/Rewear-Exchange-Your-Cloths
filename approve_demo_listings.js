const mongoose = require("mongoose");
const Listing = require("../models/listings");

async function approveDemoListings() {
    await mongoose.connect("mongodb://127.0.0.1:27017/Rewear");
    console.log("Connected to DB...");

    const result = await Listing.updateMany(
        { productName: { $ne: "Nike Air Max Sneakers" } },
        { $set: { status: "ADMIN_APPROVED" } }
    );

    console.log(`Updated ${result.modifiedCount} demo listings to ADMIN_APPROVED status!`);

    const allApproved = await Listing.find({ status: "ADMIN_APPROVED" });
    console.log("Currently Approved & Visible Public Listings:", allApproved.length);
    allApproved.forEach(item => console.log(`- ${item.productName} (${item.brand}) [${item.price} Credits]`));

    await mongoose.connection.close();
}

approveDemoListings().catch(console.error);
