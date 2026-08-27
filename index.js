const mongoose = require("mongoose");
const initdata = require("./data");
const Listings = require("../models/listings");

async function main() {
  await mongoose.connect("mongodb://127.0.0.1:27017/Rewear");
  console.log("Connected to DB");
}

const initDB = async () => {
  await Listings.deleteMany({}); // optional: clears old data
  await Listings.insertMany(initdata.data);
  console.log("Data inserted successfully");
};

main()
  .then(() => initDB())
  .then(() => mongoose.connection.close())
  .catch((err) => console.log(err));