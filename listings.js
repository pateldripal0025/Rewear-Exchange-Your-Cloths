const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const listingSchema = new Schema({
  productName: {
    type: String,
    required: [true, "Product Name required"]
  },
  image: {
    url: String,
    filename: String,
  },
  images: [{
    url: String,
    filename: String
  }],
  // Compulsory 3-Image System
  frontImage: {
    url: String,
    filename: String
  },
  backImage: {
    url: String,
    filename: String
  },
  labelImage: {
    url: String,
    filename: String
  },
  // Listing Lifecycle State
  status: {
    type: String,
    enum: ["DRAFT", "AI_PROCESSING", "AI_EVALUATED", "PENDING_ADMIN_REVIEW", "ADMIN_APPROVED", "ADMIN_REJECTED", "AI_REVIEW_FAILED"],
    default: "PENDING_ADMIN_REVIEW"
  },
  description: {
    type: String,
    required: [true, "Description is required"],
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  brand: {
    type: String,
    required: [true, "Brand is required"],
  },
  category: {
    type: String,
    default: ""
  },
  itemType: {
    type: String,
    required: [true, "Item type is required"],
  },
  gender: {
    type: String,
    required: [true, "Gender is required"],
    enum: ["Men", "Women", "Unisex", "Kids"]
  },
  size: {
    type: String,
    required: [true, "Size is required"],
    validate: {
      validator: function(v) {
        let typeToCheck = "";
        if (this.itemType) {
             typeToCheck = this.itemType.toLowerCase();
        } else if (this.getUpdate && this.getUpdate().$set && this.getUpdate().$set.itemType) {
             typeToCheck = this.getUpdate().$set.itemType.toLowerCase();
        } else {
             return true; 
        }

        if (typeToCheck === "shoes") {
          const sizeNum = Number(v);
          return !isNaN(sizeNum) && sizeNum >= 1 && sizeNum <= 15;
        } else {
          const valUpper = String(v).trim().toUpperCase();
          const allowedSizes = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "FREE SIZE", "ONE SIZE", "FREE", "OS"];
          if (allowedSizes.includes(valUpper)) return true;
          const numVal = Number(valUpper);
          return !isNaN(numVal) && numVal >= 20 && numVal <= 60;
        }
      },
      message: props => "Please enter a valid size (e.g. S, M, L, XL, XXL or waist size 28-44)."
    }
  },
  color: {
    type: String,
    required: [true, "Color is required"]
  },
  material: {
    type: String,
    default: ""
  },
  condition: {
    type: String,
    required: [true, "Condition is required"],
    enum: ["New with Tags", "Like New", "Excellent", "Good", "Fair"]
  },
  productAge: {
    type: String,
    required: [true, "Age of Product is required"],
    enum: ["Less than 6 months", "6–12 months", "1–2 years", "More than 2 years"]
  },
  exchangeAvailable: {
    type: Boolean,
    default: true
  },
  preferredItems: {
    type: String,
    default: ""
  },
  additionalNotes: {
    type: String,
    default: ""
  },
  defects: {
    type: String,
    default: ""
  },
  aiEstimatedCreditValue: {
    type: Number,
    default: null
  },
  // AI Vision Evaluation Data
  aiEvaluation: {
    productType: { type: String, default: "" },
    detectedBrand: { type: String, default: "" },
    detectedSize: { type: String, default: "" },
    detectedCondition: { type: String, default: "" },
    detectedColor: { type: String, default: "" },
    detectedMaterial: { type: String, default: "" },
    estimatedValueINR: { type: Number, default: 0 },
    suggestedCredits: { type: Number, default: 0 },
    confidence: { type: String, default: "Medium" },
    detectedIssues: [{ type: String }],
    informationMismatch: { type: Boolean, default: false },
    valuationReasoning: { type: String, default: "" },
    analyzedAt: { type: Date }
  },
  // Admin Review & Authorization Data
  adminReview: {
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    finalValueINR: { type: Number },
    finalCredits: { type: Number },
    rejectionReason: { type: String, default: "" }
  },
  price: {
    type: Number,
    default: 0,
    min: [0, "Price cannot be negative"]
  }
}, { timestamps: true });

module.exports = mongoose.model("Listing", listingSchema);