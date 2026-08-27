require('dotenv').config();
const http = require("http");
const express = require('express');
const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 8080;
const { initSocket } = require("./services/socketService");
const adminRoutes = require("./routes/admin");
const exchangeRoutes = require("./routes/exchanges");
const exchangeService = require("./services/exchangeService");
const mongoose = require('mongoose');
const Listing = require('./models/listings');
const Request = require('./models/request');
const listings = require('./models/listings');
const path = require("path");
const methodOverride = require("method-override");
const engine = require("ejs-mate");
let cookieParser;
try {
    cookieParser = require('cookie-parser');
} catch (e) {
    console.error("cookie-parser not found, running without cookie support");
}
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user");
const {isLoggedIn, isOwner, saveRedirectUrl} = require("./middleware");
const multer  = require('multer');
const { storage } = require("./cloudConfig");
const upload = multer({ storage });
const flash = require("connect-flash");
const wrapAsync = require("./utils/wrapAsync");
const ExpressError = require("./utils/ExpressError");
const openaiService = require("./services/openaiService");
const aiService = require("./services/aiService");

const uploadListingImages = upload.any();


const dbUrl = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/Rewear';

async function main() {
    if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(dbUrl);
    }
    console.log("Connected to DB");
}
main().catch(err => console.log(err));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
if (cookieParser) {
    app.use(cookieParser());
}
app.use(methodOverride("_method"));
app.engine('ejs', engine);
app.use(express.static(path.join(__dirname, "/public")));

const connectMongo = require('connect-mongo');
const MongoStore = connectMongo.default || connectMongo;

const store = MongoStore.create({
    mongoUrl: dbUrl,
    crypto: {
        secret: "rewearsecret"
    },
    touchAfter: 24 * 3600
});

store.on("error", (err) => {
    console.log("ERROR in MONGO SESSION STORE", err);
});

// session setup for authentication
const sessionOptions = {
    store,
    secret: "rewearsecret",
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true
    }
};

const expressSessionMiddleware = session(sessionOptions);
app.use(expressSessionMiddleware);
initSocket(server, expressSessionMiddleware);

// passport setup

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// passport middleware

app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    next();
});

app.use(flash());

app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currTheme = (req.cookies && req.cookies.theme) ? req.cookies.theme : "dark";
    console.log("THEME COOKIE RECEIVED:", req.cookies ? req.cookies.theme : "no req.cookies", "path:", req.path);
    res.locals.hideNavbar = false;
    next();
});

app.use("/admin", adminRoutes);
app.use("/exchanges", exchangeRoutes);

app.get("/", wrapAsync(async (req, res) => {
    const featuredListings = await Listing.find({
        status: { $in: ["ADMIN_APPROVED", "PUBLISHED"] }
    }).sort({ _id: -1 }).limit(6);
    res.render("home.ejs", { featuredListings });
}));

app.get("/testing", async (req, res) => {
    let sample = new Listing({
        brand: "Zara",
        itemType: "Jacket",
        size: "M",
        price: 450
    });

    await sample.save();
    console.log("Sample saved");
    res.send("Sample saved to DB");
});
// index route

function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

app.get("/listings", wrapAsync(async (req, res) => {
    const { q } = req.query;
    const publicStatusFilter = {
        $or: [
            { status: { $in: ["ADMIN_APPROVED", "PUBLISHED", null, ""] } },
            { status: { $exists: false } }
        ]
    };

    let filter = publicStatusFilter;

    if (q) {
        const regex = new RegExp(escapeRegex(q), 'gi');
        filter = {
            $and: [
                publicStatusFilter,
                {
                    $or: [
                        { productName: regex },
                        { brand: regex },
                        { itemType: regex }
                    ]
                }
            ]
        };
    }
    const allListings = await Listing.find(filter).sort({ _id: -1 });
    console.log("[DEBUG ROUTE]", { q, count: allListings.length });
    
    // Pass searchQuery down to the view so it can display conditional UI
    res.render("listings/index.ejs", { allListings, searchQuery: q });
}));

// Toggle Wishlist (Moved up for priority)
app.post("/listings/:id/wishlist", isLoggedIn, wrapAsync(async (req, res) => {
    const { id } = req.params;
    const user = await User.findById(req.user._id);
    
    // Use toString() comparison to be safe with ObjectIds
    const index = user.wishlist.findIndex(item => item.toString() === id);
    let inWishlist = false;
    
    if (index === -1) {
        user.wishlist.push(id);
        req.flash("success", "Added to wishlist!");
        inWishlist = true;
    } else {
        user.wishlist.splice(index, 1);
        req.flash("success", "Removed from wishlist!");
        inWishlist = false;
    }
    
    await user.save();

    // Check if it's an AJAX request
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
        return res.json({ success: true, inWishlist: inWishlist });
    }
    
    res.redirect("back");
}));

// New Route

app.get("/listings/new", isLoggedIn, (req, res) => {
    res.render("listings/new.ejs");
});

// Show Valuation Screen (User AI Evaluation Preview)
app.get("/listings/:id/valuation", isLoggedIn, wrapAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id).populate("owner");
    if (!listing) {
        req.flash("error", "Listing not found.");
        return res.redirect("/listings");
    }

    const isOwner = listing.owner._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) {
        req.flash("error", "Unauthorized access.");
        return res.redirect("/listings");
    }

    res.render("listings/valuation.ejs", { listing });
}));

// Show Route

app.get("/listings/:id", wrapAsync(async (req, res, next) => {
    const { id } = req.params;
    const listing = await Listing.findById(id).populate("owner");
    if (!listing) {
        req.flash("error", "Listing you requested for does not exist!");
        return res.redirect("/listings");
    }

    // Check if listing is approved or if current user is owner / admin
    const isOwner = req.user && listing.owner && listing.owner._id.toString() === req.user._id.toString();
    const isAdmin = req.user && req.user.role === "admin";
    const isApproved = listing.status === "ADMIN_APPROVED" || listing.status === "PUBLISHED";

    if (!isApproved && !isOwner && !isAdmin) {
        req.flash("error", "This listing is currently undergoing Admin Review and is not publicly visible.");
        return res.redirect("/listings");
    }

    // Find similar items (same itemType, excluding the current item)
    const similarListings = await Listing.find({
        itemType: listing.itemType,
        _id: { $ne: listing._id },
        status: { $in: ["ADMIN_APPROVED", "PUBLISHED"] }
    }).limit(4);

    res.render("listings/show.ejs", { listing, similarListings });
}));

// Create route (With AI Vision Analysis & Compulsory 3-Image Upload)

app.post("/listings", isLoggedIn, uploadListingImages, wrapAsync(async (req, res, next) => {
    try {
        if (!req.body.listing) {
            req.flash("error", "Please fill in all required listing fields.");
            return res.redirect("/listings/new");
        }

        // Compulsory 3-Image Validation (Backend Enforced & Flexible Field Matching)
        let frontFile, backFile, labelFile;

        if (Array.isArray(req.files)) {
            frontFile = req.files.find(f => f.fieldname === 'frontImage') || req.files[0];
            backFile = req.files.find(f => f.fieldname === 'backImage') || req.files[1];
            labelFile = req.files.find(f => f.fieldname === 'labelImage') || req.files[2];
        } else if (req.files) {
            frontFile = req.files.frontImage?.[0];
            backFile = req.files.backImage?.[0];
            labelFile = req.files.labelImage?.[0];
        }

        if (!frontFile || !backFile || !labelFile) {
            req.flash("error", "Compulsory product images missing. You must upload Front Image, Back Image, and Label Image.");
            return res.redirect("/listings/new");
        }

        const newListing = new Listing(req.body.listing);

        newListing.frontImage = { url: frontFile.path, filename: frontFile.filename };
        newListing.backImage = { url: backFile.path, filename: backFile.filename };
        newListing.labelImage = { url: labelFile.path, filename: labelFile.filename };

        // Standard images array for legacy gallery compatibility
        newListing.images = [
            newListing.frontImage,
            newListing.backImage,
            newListing.labelImage
        ];
        newListing.image = newListing.frontImage;

        newListing.exchangeAvailable = req.body.listing.exchangeAvailable === "true";
        newListing.owner = req.user._id;
        newListing.status = "AI_PROCESSING";
        await newListing.save();

        // Invoke AI Vision Analysis Service
        const aiResult = await aiService.analyzeListingImages(
            newListing.frontImage.url,
            newListing.backImage.url,
            newListing.labelImage.url,
            {
                productName: newListing.productName,
                brand: newListing.brand,
                size: newListing.size,
                condition: newListing.condition,
                itemType: newListing.itemType,
                color: newListing.color,
                material: newListing.material,
                description: newListing.description
            }
        );

        if (aiResult.success && aiResult.data) {
            newListing.aiEvaluation = aiResult.data;
            newListing.aiEstimatedCreditValue = aiResult.data.suggestedCredits;
            newListing.price = aiResult.data.suggestedCredits; // AI suggested credit value pending admin review
            newListing.status = "PENDING_ADMIN_REVIEW";
        } else {
            newListing.status = "AI_REVIEW_FAILED";
            newListing.aiEvaluation = aiResult.data || {};
        }

        await newListing.save();

        req.flash("success", "Listing submitted! AI evaluation completed. Awaiting Admin Approval.");
        res.redirect(`/listings/${newListing._id}/valuation`);

    } catch (err) {
        console.error("Listing Creation Error:", err.message);
        req.flash("error", err.message || "Failed to create listing. Please check your form inputs.");
        res.redirect("/listings/new");
    }
}));

// Edit Route

app.get("/listings/:id/edit", isLoggedIn, isOwner, wrapAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing you requested for does not exist!");
        return res.redirect("/listings");
    }
    res.render("listings/edit.ejs", { listing });
}));

// Update Route

app.put("/listings/:id", isLoggedIn, isOwner, upload.array('listing[images]', 5), wrapAsync(async (req, res) => {
    const { id } = req.params;
    
    if (!req.body.listing) {
        throw new ExpressError(400, "Send valid data for listing");
    }

    // Convert exchangeAvailable checkbox/radio to boolean
    req.body.listing.exchangeAvailable = req.body.listing.exchangeAvailable === "true";

    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing not found!");
        return res.redirect("/listings");
    }

    // Update all text/number fields
    Object.assign(listing, req.body.listing);

    // Process deleted existing images
    let deletedImages = req.body.deletedImages || [];
    if (!Array.isArray(deletedImages)) {
        deletedImages = [deletedImages];
    }
    
    if (deletedImages.length > 0) {
        listing.images = listing.images.filter(img => !deletedImages.includes(img.filename));
    }

    // Process newly uploaded images
    if (req.files && req.files.length > 0) {
        const newImages = req.files.map(file => ({ url: file.path, filename: file.filename }));
        listing.images.push(...newImages);
    }

    // Cap total images at 5
    if (listing.images.length > 5) {
        listing.images = listing.images.slice(0, 5);
    }

    // Update the main fallback image to the first one in the list
    if (listing.images.length > 0) {
        listing.image = listing.images[0];
    } else {
        const defaultImage = { url: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=736&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", filename: "default" };
        listing.images = [defaultImage];
        listing.image = defaultImage;
    }

    await listing.save();
    req.flash("success", "Listing Updated!");
    res.redirect(`/listings/${id}`);
}));

// Delete Route

app.delete("/listings/:id", isLoggedIn, isOwner, wrapAsync(async (req, res) => {
    const { id } = req.params;
    
    // Cleanup: Remove all requests associated with this listing
    await Request.deleteMany({ listing: id });
    
    // Cleanup: Remove this listing from all users' wishlists
    await User.updateMany(
        { wishlist: id },
        { $pull: { wishlist: id } }
    );

    await Listing.findByIdAndDelete(id);
    req.flash("success", "Listing Deleted!");
    res.redirect("/listings");
}));

// Social Actions: Request & Wishlist

// Send Request
app.post("/listings/:id/request", isLoggedIn, wrapAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    
    if (!listing) {
        req.flash("error", "Listing not found!");
        return res.redirect("/listings");
    }

    if (listing.owner.equals(req.user._id)) {
        req.flash("error", "You cannot send a request for your own listing!");
        return res.redirect(`/listings/${id}`);
    }

    // Check if an active request already exists for this user and item
    const existingRequest = await Request.findOne({
        listing: id,
        sender: req.user._id,
        status: { $in: ["PENDING_OWNER", "PENDING_ADMIN", "ADMIN_APPROVED", "CHAT_ACTIVE", "USER_A_ACCEPTED", "USER_B_ACCEPTED"] }
    });

    if (existingRequest) {
        req.flash("error", "You have an active exchange request pending for this item!");
        return res.redirect(`/listings/${id}`);
    }

    const newRequest = new Request({
        listing: id,
        sender: req.user._id,
        receiver: listing.owner,
        status: "PENDING_OWNER",
        creditValue: listing.price || 0
    });

    await newRequest.save();
    req.flash("success", "Exchange request sent to the owner.");
    res.redirect(`/listings/${id}`);
}));

// Accept/Reject Request (Product Owner User B Action)
app.post("/requests/:id/:action", isLoggedIn, wrapAsync(async (req, res) => {
    const { id, action } = req.params;
    const result = await exchangeService.ownerDecision(id, req.user._id, action.toUpperCase());
    req.flash("success", result.message);
    res.redirect("/dashboard");
}));

// User Dashboard & Profile

app.get("/dashboard", isLoggedIn, wrapAsync(async (req, res) => {
    const user = await User.findById(req.user._id).populate("wishlist");
    
    // Products Listed by Current User
    const myListings = await Listing.find({ owner: req.user._id }).sort({ createdAt: -1 });

    // Requests for My Items (Owner Pending Review)
    const incomingRequests = await Request.find({
        receiver: req.user._id,
        status: { $in: ["PENDING_OWNER", "pending"] }
    })
    .populate("sender")
    .populate("listing")
    .sort({ createdAt: -1 });

    // Requests I have Sent
    const sentRequests = await Request.find({ sender: req.user._id })
        .populate("receiver")
        .populate("listing")
        .sort({ createdAt: -1 });

    // Active Exchanges (Approved by Admin & Chat Active or Completed)
    const activeExchanges = await Request.find({
        $or: [{ sender: req.user._id }, { receiver: req.user._id }],
        status: { $in: ["ADMIN_APPROVED", "CHAT_ACTIVE", "USER_A_ACCEPTED", "USER_B_ACCEPTED", "COMPLETED"] }
    })
    .populate("sender")
    .populate("receiver")
    .populate("listing")
    .sort({ createdAt: -1 });

    res.render("users/dashboard.ejs", { user, myListings, incomingRequests, sentRequests, activeExchanges });
}));

app.get("/profile/edit", isLoggedIn, (req, res) => {
    res.render("users/edit_profile.ejs", { user: req.user });
});

app.put("/profile", isLoggedIn, wrapAsync(async (req, res) => {
    const { username } = req.body;
    await User.findByIdAndUpdate(req.user._id, { username });
    req.flash("success", "Username updated!");
    res.redirect("/dashboard");
}));

app.put("/profile/password", isLoggedIn, wrapAsync(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    await user.changePassword(oldPassword, newPassword);
    req.flash("success", "Password updated!");
    res.redirect("/dashboard");
}));

// signUp routes

app.get("/signup", (req, res) => {
    res.render("users/signup", { hideNavbar: true });
});

app.post("/signup", async (req, res) => {

    let { username, email, password } = req.body;

    // Gmail validation
    if (!email.endsWith("@gmail.com")) {
        return res.send("Only Gmail addresses allowed");
    }

    try {

        const startingPoints = Math.floor(Math.random() * 4001) + 1000;
        const newUser = new User({
            username: username,
            email: email,
            points: startingPoints
        });

        const registeredUser = await User.register(newUser, password);

        req.login(registeredUser, (err) => {
            if (err) {
                return next(err);
            }

            req.flash("success", "Welcome to ReWear!");
            res.redirect("/");
        });

    } catch (e) {
        req.flash("error", e.message);
        res.redirect("/signup");
    }

});

// login route

app.get("/login", (req, res) => {
    res.render("users/login", { hideNavbar: true });
});

app.post("/login",
    saveRedirectUrl,
    passport.authenticate("local", {
        failureRedirect: "/login",
        failureFlash: true
    }),
    (req, res) => {
        req.flash("success", "Welcome back to ReWear!");
        let redirectUrl = res.locals.redirectUrl || "/";
        res.redirect(redirectUrl);
    });

// logout route

app.get("/logout", (req, res, next) => {
    req.logout((err) => {
        if(err) {
            return next(err);
        }
        req.flash("success", "You are logged out!");
        res.redirect("/listings");
    });
});

// POST /api/chat/listing
app.post("/api/chat/listing", wrapAsync(async (req, res) => {
    const { listingId, userMessage } = req.body;
    if (!listingId || !userMessage) {
        return res.status(400).json({ error: "listingId and userMessage are required." });
    }

    const listing = await Listing.findById(listingId).populate("owner");
    if (!listing) {
        return res.status(404).json({ error: "Listing not found." });
    }

    const systemPrompt = `You are a helpful, friendly, and knowledgeable AI Product Assistant for ReWear (an online clothes exchange application).
You are assisting a user interested in the following clothing item:
- Brand: ${listing.brand}
- Product Name: ${listing.productName}
- Price: ${listing.price} points
- Size: ${listing.size}
- Item Type: ${listing.itemType}
- Description: ${listing.description || "No description provided"}
- Owner: ${listing.owner ? listing.owner.username : "Unknown"}

Answer any questions the user has about this item based on the details above. If the information is not provided in the details, politely explain that you do not know or suggest they contact the owner (${listing.owner ? listing.owner.username : "the owner"}). Keep your responses concise, natural, and friendly. Do not use Markdown formatting in your replies (like **bolding** or lists), just write normal plain text.`;

    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
    ];

    const aiResponse = await openaiService.generateChatCompletion(messages);
    res.json({ response: aiResponse });
}));

app.use((req, res, next) => {
    next(new ExpressError(404, "Page Not Found!"));
});

app.use((err, req, res, next) => {
    console.error("EXPRESS ERROR:", err);
    let { statusCode = 500, message = "Something went wrong!" } = err;
    
    // Handle mongoose validation errors gracefully instead of crashing
    if (err.name === 'ValidationError') {
        const msg = Object.values(err.errors).map(el => el.message).join(',');
        req.flash("error", msg);
        const redirectUrl = req.get('Referrer') || '/listings';
        return res.redirect(redirectUrl);
    }
    
    if (err instanceof multer.MulterError) {
        console.error("Multer Error:", err.code, err.message);
        req.flash("error", "Image upload error: Please select 3 valid image files (Front, Back, Label).");
        return res.redirect(req.get('Referrer') || '/listings/new');
    }

    if (err.name === 'CastError') {
        req.flash("error", "Invalid ID format.");
        return res.redirect("/listings");
    }

    req.flash("error", message);
    const fallbackUrl = req.get('Referrer') || '/listings';
    res.redirect(fallbackUrl);
});

server.listen(port, () => {
    console.log(`Listening on port ${port}`);
});