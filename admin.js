const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const { isAdmin } = require("../middleware");
const User = require("../models/user");
const Listing = require("../models/listings");
const Request = require("../models/request");
const Conversation = require("../models/conversation");
const Message = require("../models/message");
const Transaction = require("../models/transaction");
const exchangeService = require("../services/exchangeService");
const { broadcastStatusUpdate } = require("../services/socketService");

// Protect all admin routes
router.use(isAdmin);

// Redirect /admin to /admin/dashboard
router.get("/", (req, res) => {
    res.redirect("/admin/dashboard");
});

// Admin Dashboard - Real DB Statistics
router.get("/dashboard", wrapAsync(async (req, res) => {
    const totalUsers = await User.countDocuments();
    const totalListings = await Listing.countDocuments();
    
    // Admin only counts requests where owner has accepted (PENDING_ADMIN)
    const pendingRequests = await Request.countDocuments({ 
        status: { $in: ["PENDING_ADMIN", "PENDING_ADMIN_REVIEW", "pending"] } 
    });

    // New clothing listings waiting for admin approval
    const pendingListingApprovals = await Listing.countDocuments({
        status: { $in: ["PENDING_ADMIN_REVIEW", "AI_EVALUATED", "AI_PROCESSING", "AI_REVIEW_FAILED"] }
    });

    const pendingListingsList = await Listing.find({
        status: { $in: ["PENDING_ADMIN_REVIEW", "AI_EVALUATED", "AI_PROCESSING", "AI_REVIEW_FAILED"] }
    })
    .populate("owner")
    .sort({ createdAt: -1 })
    .limit(6);
    
    const approvedExchanges = await Request.countDocuments({ 
        status: { $in: ["ADMIN_APPROVED", "CHAT_ACTIVE", "USER_A_ACCEPTED", "USER_B_ACCEPTED"] } 
    });
    
    const completedExchanges = await Request.countDocuments({ 
        status: { $in: ["COMPLETED", "accepted"] } 
    });
    
    const rejectedRequests = await Request.countDocuments({ 
        status: { $in: ["ADMIN_REJECTED", "OWNER_REJECTED", "rejected"] } 
    });
    
    const cancelledExchanges = await Request.countDocuments({ 
        status: { $in: ["CANCELLED", "USER_A_REJECTED", "USER_B_REJECTED"] } 
    });

    // Sum total credits exchanged in completed deals
    const completedDocs = await Request.find({ status: "COMPLETED" });
    const totalCreditsExchanged = completedDocs.reduce((acc, curr) => acc + (curr.creditValue || 0), 0);

    const recentRequests = await Request.find({
        status: { $in: ["PENDING_ADMIN", "PENDING_ADMIN_REVIEW", "pending"] }
    })
    .populate("sender receiver listing")
    .sort({ createdAt: -1 })
    .limit(6);

    res.render("admin/dashboard", {
        layout: false,
        totalUsers,
        totalListings,
        pendingRequests,
        pendingListingApprovals,
        pendingListingsList,
        approvedExchanges,
        completedExchanges,
        rejectedRequests,
        cancelledExchanges,
        totalCreditsExchanged,
        recentRequests
    });
}));

// Admin Requests Queue Page (By default displays PENDING_ADMIN requests)
router.get("/requests", wrapAsync(async (req, res) => {
    const { status } = req.query;
    let query = {};

    if (!status || status === "pending") {
        // Default view: ONLY requests that owner has accepted and require Admin approval
        query.status = { $in: ["PENDING_ADMIN", "PENDING_ADMIN_REVIEW", "pending"] };
    } else if (status === "approved") {
        query.status = { $in: ["ADMIN_APPROVED", "CHAT_ACTIVE", "USER_A_ACCEPTED", "USER_B_ACCEPTED"] };
    } else if (status === "completed") {
        query.status = { $in: ["COMPLETED", "accepted"] };
    } else if (status === "rejected") {
        query.status = { $in: ["ADMIN_REJECTED", "OWNER_REJECTED", "rejected"] };
    } else if (status === "cancelled") {
        query.status = { $in: ["CANCELLED", "USER_A_REJECTED", "USER_B_REJECTED"] };
    } else if (status === "all") {
        query = {};
    }

    const requests = await Request.find(query)
        .populate("sender receiver listing")
        .sort({ createdAt: -1 });

    res.render("admin/requests", {
        layout: false,
        requests,
        currentStatus: status || "pending"
    });
}));

// Admin Single Request Detail View & Chat Moderation
router.get("/requests/:id", wrapAsync(async (req, res) => {
    const { id } = req.params;
    const requestItem = await Request.findById(id).populate("sender receiver listing");

    if (!requestItem) {
        req.flash("error", "Exchange request not found.");
        return res.redirect("/admin/requests");
    }

    // Get chat log if active
    let messages = [];
    const conversation = await Conversation.findOne({ exchange: id });
    if (conversation) {
        messages = await Message.find({ conversation: conversation._id })
            .populate("sender", "username email role")
            .sort({ createdAt: 1 });
    }

    res.render("admin/request_show", {
        layout: false,
        requestItem,
        messages
    });
}));

// Admin Review POST Endpoint (APPROVE / REJECT)
router.post("/requests/:id/review", wrapAsync(async (req, res) => {
    const { id } = req.params;
    const { action, adminNotes } = req.body;

    try {
        const result = await exchangeService.reviewExchange(id, action, adminNotes);
        
        broadcastStatusUpdate(id, {
            status: result.status,
            message: `Admin ${action === "APPROVE" ? "approved" : "rejected"} this exchange request.`
        });

        req.flash("success", `Exchange Request #${id.slice(-6)} has been ${action === "APPROVE" ? "Approved" : "Rejected"} successfully.`);
    } catch (err) {
        req.flash("error", err.message || "Failed to process admin review.");
    }

    res.redirect(`/admin/requests/${id}`);
}));

// Admin Users Directory
router.get("/users", wrapAsync(async (req, res) => {
    const users = await User.find().sort({ createdAt: -1 });
    res.render("admin/users", {
        layout: false,
        users
    });
}));

// Admin Listings Inventory
router.get("/listings", wrapAsync(async (req, res) => {
    const listings = await Listing.find().populate("owner").sort({ _id: -1 });
    res.render("admin/listings", {
        layout: false,
        listings
    });
}));

// Admin Listing Review Queue
router.get("/listings/review", wrapAsync(async (req, res) => {
    const { status } = req.query;
    let query = {};

    if (!status || status === "pending") {
        query.status = { $in: ["PENDING_ADMIN_REVIEW", "AI_EVALUATED", "AI_PROCESSING", "AI_REVIEW_FAILED"] };
    } else if (status === "approved") {
        query.status = { $in: ["ADMIN_APPROVED", "PUBLISHED"] };
    } else if (status === "rejected") {
        query.status = "ADMIN_REJECTED";
    } else if (status === "all") {
        query = {};
    }

    const listings = await Listing.find(query)
        .populate("owner")
        .sort({ createdAt: -1 });

    res.render("admin/listing_review_queue", {
        layout: false,
        listings,
        currentStatus: status || "pending"
    });
}));

// Admin Single Listing Review Inspection Page
router.get("/listings/review/:id", wrapAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id).populate("owner");

    if (!listing) {
        req.flash("error", "Listing not found.");
        return res.redirect("/admin/listings/review");
    }

    res.render("admin/listing_review_show", {
        layout: false,
        listing
    });
}));

// Admin Approve Listing & Override Credit Value
router.post("/listings/review/:id/approve", wrapAsync(async (req, res) => {
    const { id } = req.params;
    const { finalValueINR, finalCredits } = req.body;

    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing not found.");
        return res.redirect("/admin/listings/review");
    }

    const approvedCredits = Math.max(0, parseInt(finalCredits || finalValueINR || listing.aiEstimatedCreditValue || 1000));
    const approvedValueINR = parseInt(finalValueINR || approvedCredits);

    listing.status = "ADMIN_APPROVED";
    listing.price = approvedCredits; // Main listing credit cost
    listing.adminReview = {
        reviewedBy: req.user._id,
        reviewedAt: new Date(),
        finalValueINR: approvedValueINR,
        finalCredits: approvedCredits
    };

    await listing.save();

    req.flash("success", `Listing "${listing.productName}" Approved & Published at ${approvedCredits} Credits!`);
    res.redirect("/admin/listings/review?status=approved");
}));

// Admin Reject Listing
router.post("/listings/review/:id/reject", wrapAsync(async (req, res) => {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing not found.");
        return res.redirect("/admin/listings/review");
    }

    listing.status = "ADMIN_REJECTED";
    listing.adminReview = {
        reviewedBy: req.user._id,
        reviewedAt: new Date(),
        rejectionReason: rejectionReason || "Listing did not meet ReWear publication guidelines."
    };

    await listing.save();

    req.flash("success", `Listing "${listing.productName}" Rejected.`);
    res.redirect("/admin/listings/review?status=rejected");
}));

module.exports = router;
