require('dotenv').config({ path: '../.env' });
const mongoose = require("mongoose");
const initdata = require("./data");
const Listing = require("../models/listings");
const User = require("../models/user");
const { cloudinary } = require("../cloudConfig");

async function main() {
  await mongoose.connect("mongodb://127.0.0.1:27017/Rewear");
  console.log("Connected to DB");
}

const seedDemoListings = async () => {
  try {
    const demoUser = await User.findOne({ username: "demo" });
    if (!demoUser) {
      console.log("User 'demo' not found! Make sure you have signed up with username 'demo'.");
      return;
    }

    console.log("Found demo user with ID:", demoUser._id);

    await Listing.deleteMany({});
    console.log("Deleted all existing listings.");

    const newListings = [];
    console.log(`Starting upload of ${initdata.data.length} listings...`);
    
    let count = 0;
    for (let listing of initdata.data) {
        count++;
        console.log(`[${count}/${initdata.data.length}] Uploading image for ${listing.productName}...`);
        try {
            console.log(`   Config check: ${cloudinary.config().cloud_name ? 'OK' : 'FAIL'}`);
            const uploadResponse = await cloudinary.uploader.upload(listing.image.url, {
                folder: "Rewear_DEV"
            });
            
            let newListing = {
                ...listing,
                owner: demoUser._id,
                image: {
                    url: uploadResponse.secure_url,
                    filename: uploadResponse.public_id
                }
            };
            newListings.push(newListing);
            console.log(`   Success: ${listing.productName}`);
        } catch (uploadErr) {
            console.error(`   Failed to upload ${listing.productName}:`, uploadErr);
        }
    }

    console.log(`All uploads finished. Inserting ${newListings.length} listings into DB...`);
    await Listing.insertMany(newListings);
    console.log(`Successfully seeded ${newListings.length} listings!`);
  } catch (err) {
    console.error("Error during seeding:", err);
  }
};

main()
  .then(() => seedDemoListings())
  .then(() => mongoose.connection.close())
  .catch((err) => console.log(err));
