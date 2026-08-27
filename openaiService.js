class OpenAIService {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        if (!this.apiKey) {
            console.warn("WARNING: OPENAI_API_KEY environment variable is not defined.");
        }
    }

    async generateChatCompletion(messages, options = {}) {
        if (!this.apiKey) {
            throw new Error("OpenAI API key is missing. Please set OPENAI_API_KEY in your environment.");
        }

        try {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: options.model || "gpt-4o-mini",
                    messages: messages,
                    temperature: options.temperature ?? 0.7,
                    max_tokens: options.max_tokens ?? 500
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`OpenAI API error (${response.status}): ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();
            if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
                throw new Error("OpenAI response format is invalid: missing choices/message.");
            }

            return data.choices[0].message.content;
        } catch (err) {
            console.error("[OpenAI Service] Error generating chat completion:", err);
            throw err;
        }
    }
}

module.exports = new OpenAIService();
