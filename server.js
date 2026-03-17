const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors());

// Environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const JUDGEME_API_KEY = process.env.JUDGEME_API_KEY;

// Shopify store domain
const SHOP_DOMAIN = "cure-jewelry-2.myshopify.com";

// Generate AI reply
async function generateReply(review) {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `Reply to this customer review in a professional and friendly tone in max 2 sentences:\n\n${review}`
          }
        ]
      })
    });

    const data = await res.json();

    return data?.choices?.[0]?.message?.content || "Thank you for your review!";
  } catch (error) {
    console.error("AI error:", error);
    return "Thank you for your feedback!";
  }
}

// Store replied reviews
let repliedReviews = new Set();

// Check new reviews
async function checkNewReviews() {
  try {
    const url = `https://judge.me/api/v1/reviews?api_token=${JUDGEME_API_KEY}&shop_domain=${SHOP_DOMAIN}`;

    const res = await fetch(url);
    const data = await res.json();

    console.log("API response:", data);

    if (!data.reviews || !Array.isArray(data.reviews)) {
      console.error("Invalid reviews data:", data);
      return;
    }

    for (const review of data.reviews) {

      if (repliedReviews.has(review.id)) continue;

      if (!review.reply && review.content) {

        const reply = await generateReply(review.content);

        const replyUrl = `https://judge.me/api/v1/reviews/${review.id}/reply?api_token=${JUDGEME_API_KEY}&shop_domain=${SHOP_DOMAIN}`;

        await fetch(replyUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            reply: reply
          })
        });

        repliedReviews.add(review.id);

        console.log("Replied to review:", review.id);
      }
    }

  } catch (error) {
    console.error("Polling error:", error);
  }
}

// Run every 30 seconds
setInterval(checkNewReviews, 30000);

// Start server
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
