const mongoose = require("mongoose");
const User = require("./models/user");
const Listing = require("./models/listings");
const Request = require("./models/request");

async function verify() {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/Rewear");
    console.log("Connected to DB");

    // 1. Create a test user
    const user = new User({
      username: "testuser_" + Date.now(),
      email: "test_" + Date.now() + "@gmail.com",
    });
    await User.register(user, "testpass");
    console.log("Test user created:", user.username);

    // 2. Create a test listing
    const listing = new Listing({
      productName: "Test Item",
      description: "Test Description",
      price: 100,
      brand: "Test Brand",
      itemType: "Clothing",
      size: "M",
      owner: user._id,
      image: { url: "test.jpg", filename: "test" }
    });
    await listing.save();
    console.log("Test listing created");

    // 3. Add to wishlist and create a request
    user.wishlist.push(listing._id);
    await user.save();
    console.log("Added to wishlist");

    const request = new Request({
      listing: listing._id,
      sender: user._id,
      receiver: user._id, // Self request for testing
      status: "pending"
    });
    await request.save();
    console.log("Request created");

    // 4. Verify data before delete
    let populatedUser = await User.findById(user._id).populate("wishlist");
    console.log("Wishlist count before delete:", populatedUser.wishlist.length);
    console.log("Request listing before delete:", (await Request.findById(request._id).populate("listing")).listing.productName);

    // 5. Simulate deletion (since we can't run the app server directly and call the route)
    // We'll manually trigger the logic we added to the delete route
    console.log("Simulating deletion logic...");
    const listingId = listing._id;
    
    // Logic from app.js delete route:
    await Request.deleteMany({ listing: listingId });
    await User.updateMany(
        { wishlist: listingId },
        { $pull: { wishlist: listingId } }
    );
    await Listing.findByIdAndDelete(listingId);
    console.log("Deletion logic executed");

    // 6. Verify data after delete
    populatedUser = await User.findById(user._id).populate("wishlist");
    const requestsAfter = await Request.find({ $or: [{ sender: user._id }, { receiver: user._id }] });
    
    console.log("Wishlist count after delete (should be 0):", populatedUser.wishlist.length);
    console.log("Requests count after delete (should be 0):", requestsAfter.length);

    if (populatedUser.wishlist.length === 0 && requestsAfter.length === 0) {
      console.log("VERIFICATION SUCCESS: Orphaned data cleaned up.");
    } else {
      console.log("VERIFICATION FAILURE: Orphaned data remains.");
    }

    // Cleanup test user
    await User.findByIdAndDelete(user._id);
    console.log("Test user cleaned up");

    process.exit(0);
  } catch (err) {
    console.error("Verification failed:", err);
    process.exit(1);
  }
}

verify();
