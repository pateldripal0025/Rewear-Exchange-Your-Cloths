const mongoose = require('mongoose');
const Listing = require('./models/listings');

async function checkCount() {
    await mongoose.connect('mongodb://127.0.0.1:27017/Rewear');
    const count = await Listing.countDocuments();
    console.log('Current listing count:', count);
    const lastItem = await Listing.findOne().sort({ _id: -1 });
    if(lastItem) {
        console.log('Last item added:', lastItem.productName);
    }
    await mongoose.disconnect();
}

checkCount();
