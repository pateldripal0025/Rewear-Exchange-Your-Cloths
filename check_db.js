const mongoose = require("mongoose");
const Listing = require("./models/listings");

async function check() {
  await mongoose.connect("mongodb://127.0.0.1:27017/Rewear");
  const count = await Listing.countDocuments();
  console.log("Total Listings:", count);
  
  const sample = await Listing.findOne();
  if (sample) {
    console.log("Sample Listing productName:", sample.productName);
    console.log("Sample Listing description:", sample.description);
    console.log("Sample Listing size:", sample.size);
  }
  process.exit(0);
}
check();
