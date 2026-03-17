import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const JUDGEME_API_KEY = process.env.JUDGEME_API_KEY;

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
          content: `Reply to this review in 2 sentences max:\n\n${review}`
        }
      ]
    })
  });

  const data = await res.json();
  return data.choices[0].message.content;
}
app.post("/save-config", (req, res) => {
  const { apiKey } = req.body;

  console.log("Saved API key:", apiKey);

  res.json({ success: true });
});
app.post("/webhook/review-created", async (req, res) => {
  try {
    const reviewText = req.body.review?.content;
    const reviewId = req.body.review?.id;

    if (!reviewText || !reviewId) {
      return res.status(400).send("Invalid data");
    }

    const reply = await generateReply(reviewText);

    await fetch(`https://judge.me/api/reviews/${reviewId}/reply`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${JUDGEME_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ reply })
    });

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

app.get("/", (req, res) => {
  res.send("AutoReview AI backend running");
});

app.listen(3000, () => console.log("Server running"));
