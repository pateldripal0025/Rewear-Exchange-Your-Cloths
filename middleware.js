const Listing = require("./models/listings");
const Request = require("./models/request");

module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.redirectUrl = req.originalUrl;
        req.flash("error", "You must be logged in first!");
        return res.redirect("/login");
    }
    next();
};

module.exports.saveRedirectUrl = (req, res, next) => {
    if (req.session.redirectUrl) {
        res.locals.redirectUrl = req.session.redirectUrl;
    }
    next();
};

module.exports.isAdmin = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.redirectUrl = req.originalUrl;
        req.flash("error", "You must be logged in as an Admin!");
        return res.redirect("/login");
    }
    if (req.user.role !== "admin") {
        req.flash("error", "Access Denied. Administrator privilege required!");
        return res.redirect("/listings");
    }
    next();
};

module.exports.isExchangeParticipant = async (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.redirectUrl = req.originalUrl;
        req.flash("error", "You must be logged in first!");
        return res.redirect("/login");
    }
    const { id } = req.params;
    try {
        const exchange = await Request.findById(id);
        if (!exchange) {
            req.flash("error", "Exchange request not found.");
            return res.redirect("/dashboard");
        }

        const userId = req.user._id.toString();
        const isSender = exchange.sender.toString() === userId;
        const isReceiver = exchange.receiver.toString() === userId;
        const isAdminUser = req.user.role === "admin";

        if (!isSender && !isReceiver && !isAdminUser) {
            req.flash("error", "Unauthorized! You are not a participant in this exchange.");
            return res.redirect("/dashboard");
        }

        req.exchange = exchange;
        next();
    } catch (err) {
        console.error("isExchangeParticipant error:", err);
        req.flash("error", "Invalid exchange reference.");
        return res.redirect("/dashboard");
    }
};

module.exports.isOwner = async (req, res, next) => {
    let { id } = req.params;
    let listing = await Listing.findById(id);
    if (!listing || !listing.owner.equals(res.locals.currentUser._id)) {
        req.flash("error", "You do not have permission to do that.");
        return res.redirect(`/listings/${id}`);
    }
    next();
};