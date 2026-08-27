const OpenAI = require("openai");

let openai = null;
if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

/**
 * Analyzes 3 clothing product images (Front, Back, Label) alongside user metadata using OpenAI Vision.
 * Returns structured evaluation data with market valuation and mismatch checks.
 */
async function analyzeListingImages(frontUrl, backUrl, labelUrl, userMetadata = {}) {
    if (!openai) {
        console.warn("OpenAI API key missing in environment. Returning fallback AI evaluation.");
        return getFallbackEvaluation(userMetadata, "OpenAI API Key not configured.");
    }

    try {
        const systemPrompt = `You are ReWear's expert fashion authentication and second-hand clothing valuation AI.
Your task is to analyze three compulsory images of a user-submitted garment:
1. Front Image: Complete front view
2. Back Image: Complete back view
3. Label Image: Close-up of the brand & size label

Analyze all 3 images together alongside the user-provided item information:
- User Product Name: "${userMetadata.productName || ''}"
- User Declared Brand: "${userMetadata.brand || ''}"
- User Declared Size: "${userMetadata.size || ''}"
- User Declared Condition: "${userMetadata.condition || ''}"
- User Item Type: "${userMetadata.itemType || ''}"
- User Color: "${userMetadata.color || ''}"
- User Description: "${userMetadata.description || ''}"

Evaluation Rules:
1. BRAND: Read the brand from the Label Image. Compare with visible logos/tags.
2. SIZE: Read size from the Label Image (e.g. S, M, L, XL, 32, 34).
3. CONDITION: Inspect front and back images for tears, stains, fading, pilling, loose threads, or wear. Evaluate as "New with Tags", "Like New", "Excellent", "Good", or "Fair".
4. MISMATCH DETECTION: If user declared brand/size/condition differs significantly from image evidence (e.g., User entered Nike but label says Adidas), set "informationMismatch": true and add explicit warning to "detectedIssues".
5. REAL-MONEY VALUATION & CREDITS: Estimate a realistic second-hand resale value in Indian Rupees (INR ₹) based on brand tier, garment type, and condition. Convert 1 INR = 1 ReWear Credit (integer value).

Output format: You MUST return strictly valid JSON matching this exact structure:
{
  "productType": "string",
  "detectedBrand": "string",
  "detectedSize": "string",
  "detectedCondition": "string",
  "detectedColor": "string",
  "detectedMaterial": "string",
  "estimatedValueINR": 2500,
  "suggestedCredits": 2500,
  "confidence": "High" | "Medium" | "Low",
  "detectedIssues": ["string"],
  "informationMismatch": boolean,
  "valuationReasoning": "string"
}`;

        const messages = [
            { role: "system", content: systemPrompt },
            {
                role: "user",
                content: [
                    { type: "text", text: "Please evaluate these 3 uploaded clothing images and user metadata:" },
                    { type: "image_url", image_url: { url: frontUrl, detail: "high" } },
                    { type: "image_url", image_url: { url: backUrl, detail: "high" } },
                    { type: "image_url", image_url: { url: labelUrl, detail: "high" } }
                ]
            }
        ];

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: messages,
            response_format: { type: "json_object" },
            temperature: 0.2,
            max_tokens: 800
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error("Empty response from OpenAI Vision API.");
        }

        const parsedData = JSON.parse(content);

        // Sanitize and validate numeric credit value
        const valINR = Math.max(100, Math.round(Number(parsedData.estimatedValueINR || parsedData.suggestedCredits || 1000)));
        parsedData.estimatedValueINR = valINR;
        parsedData.suggestedCredits = valINR;
        parsedData.analyzedAt = new Date();

        return {
            success: true,
            data: parsedData
        };

    } catch (err) {
        console.error("AI Vision Analysis Error:", err.message);
        return {
            success: false,
            error: err.message,
            data: getFallbackEvaluation(userMetadata, err.message)
        };
    }
}

function getFallbackEvaluation(userMetadata, reason = "Manual verification required.") {
    // Generate a reasonable default estimate based on user brand & condition if AI vision fails
    const defaultVal = userMetadata.condition === "New with Tags" ? 2000 : 1500;
    return {
        productType: userMetadata.itemType || "Clothing Item",
        detectedBrand: userMetadata.brand || "Unspecified Brand",
        detectedSize: userMetadata.size || "M",
        detectedCondition: userMetadata.condition || "Good",
        detectedColor: userMetadata.color || "Multi",
        detectedMaterial: userMetadata.material || "Cotton",
        estimatedValueINR: defaultVal,
        suggestedCredits: defaultVal,
        confidence: "Low",
        detectedIssues: [`AI Automated Analysis fallback: ${reason}`],
        informationMismatch: false,
        valuationReasoning: "Fallback valuation derived from item category and declared condition pending admin review.",
        analyzedAt: new Date()
    };
}

module.exports = {
    analyzeListingImages
};
