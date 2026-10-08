import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const LEVEL_PROMPTS = {
  1: "Give a short, warm nudge (1-2 sentences) pointing the student toward the area of the bug — like a friendly classmate glancing at their screen. Don't name the fix or repeat the technical error message.",
  2: "Explain what's going wrong in plain, everyday words, like you're talking to a friend who's never coded before (2-4 sentences). Use a simple real-world comparison if it helps (like comparing brackets to matching socks, or parentheses to open doors that need to close). Don't give the exact fixed code yet.",
  3: "In a warm, encouraging tone, briefly explain the fix in plain words, then show the corrected line(s) of code.",
};

const TONE_RULES = `
Talk like a patient, encouraging friend, not a textbook or a compiler.
Rules:
- No jargon: never say "syntax", "token", "semantics", "parser", "identifier", or similar technical words. If you must refer to something like { } or ( ), just call them "curly braces" or "parentheses" in plain words, not "tokens".
- Use short, simple sentences a total beginner would understand.
- Be encouraging, never condescending. Assume they're smart but new to this.
- No corporate or robotic phrasing ("please note that", "it appears that").
`;

app.post("/api/hint", async (req, res) => {
  const { code, error, level } = req.body;

  if (!code || !error || !level) {
    return res.status(400).json({ error: "Missing code, error, or level" });
  }

  const instruction = LEVEL_PROMPTS[level];
  if (!instruction) {
    return res.status(400).json({ error: "level must be 1, 2, or 3" });
  }

  const prompt = `A beginner's JavaScript code has a syntax error.

Code:
\`\`\`javascript
${code}
\`\`\`

Parser error (for your reference only, don't repeat this technical text to the student): "${error.message}" at line ${error.line}, column ${error.column}.

${TONE_RULES}

${instruction}
Keep your answer under 80 words.`;

  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq API error:", data);
      return res.status(502).json({ error: "AI request failed" });
    }

    const text = data.choices?.[0]?.message?.content ?? "No response.";
    res.json({ hint: text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));