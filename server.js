import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

app.use(express.json());
app.use(cors());

// 🔐 ENV VARIABLES
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const JUDGEME_API_KEY = process.env.JUDGEME_API_KEY;

// ⚠️ RANPLASE SA AK STORE OU
const SHOP_DOMAIN = "cure-jewelry-2.myshopify.com";

// 🤖 GENERATE AI REPLY
async function generateReply(review) {
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
  return data.choices?.[0]?.message?.content || "Thank you for your review!";
}

// 💾 SAVE CONFIG (test)
app.post("/save-config", (req, res) => {
  const { apiKey } = req.body;
  console.log("Saved API key:", apiKey);
  res.json({ success: true });
});

// 🔁 POLLING SYSTEM (NO WEBHOOK)
let repliedReviews = new Set();

async function checkNewReviews() {
  try {
    // ✅ CORRECT JUDGEME API CALL
    const res = await fetch(
      `https://judge.me/api/v1/reviews?api_token=${JUDGEME_API_KEY}&shop_domain=${SHOP_DOMAIN}`
    );

    const data = await res.json();

    console.log("🔍 API response:", data);

    // ❌ PROTECTION (fix error data.reviews)
    if (!data.reviews || !Array.isArray(data.reviews)) {
      console.log("❌ Invalid reviews data:", data);
      return;
    }

    for (const review of data.reviews) {

      // ⛔ evite double reply
      if (repliedReviews.has(review.id)) continue;

      // ✅ si review pa gen reply
      if (!review.reply) {

        const reply = await generateReply(review.content);

        // ✅ SEND REPLY (CORRECT FORMAT)
        await fetch(
          `https://judge.me/api/v1/reviews/${review.id}/reply?api_token=${JUDGEME_API_KEY}&shop_domain=${SHOP_DOMAIN}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              reply: reply
            })
          }
        );

        repliedReviews.add(review.id);

        console.log("✅ Replied to review:", review.id);
      }
    }

  } catch (error) {
    console.error("❌ Polling error:", error);
  }
}

// 🔁 RUN EVERY 30 SECONDS
setInterval(checkNewReviews, 30000);

// 🚀 START SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
