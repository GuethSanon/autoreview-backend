import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

// ENV VARIABLES
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const JUDGEME_API_KEY = process.env.JUDGEME_API_KEY;

// AI GENERATION
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
  return data.choices[0].message.content;
}

// SAVE CONFIG (test)
app.post("/save-config", (req, res) => {
  const { apiKey } = req.body;
  console.log("Saved API key:", apiKey);
  res.json({ success: true });
});

// POLLING SYSTEM
let repliedReviews = new Set();

async function checkNewReviews() {
  try {
    const res = await fetch("https://judge.me/api/v1/reviews", {
      headers: {
        "Authorization": `Bearer ${JUDGEME_API_KEY}`
      }
    });

    const data = await res.json();

    console.log("🔍 API response:", data);

    // FIX ERROR HERE
    if (!data.reviews || !Array.isArray(data.reviews)) {
      console.log("❌ Invalid reviews data:", data);
      return;
    }

    for (const review of data.reviews) {

      if (repliedReviews.has(review.id)) continue;

      if (!review.reply && review.content) {

        const reply = await generateReply(review.content);

        await fetch(`https://judge.me/api/v1/reviews/${review.id}/reply`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${JUDGEME_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ reply })
        });

        console.log("✅ Replied to review:", review.id);

        repliedReviews.add(review.id);
      }
    }

  } catch (err) {
    console.error("❌ Polling error:", err);
  }
}

// RUN IMMEDIATELY + EVERY 30s
checkNewReviews();
setInterval(checkNewReviews, 30000);

// ROOT
app.get("/", (req, res) => {
  res.send("AutoReview AI backend running");
});

// START SERVER
app.listen(3000, () => {
  console.log("Server running on port 3000");
});
