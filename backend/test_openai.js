require('dotenv').config({ path: 'd:/tripyatra/backend/.env' });
const OpenAI = require('openai');

async function test() {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  console.log(`Testing OpenAI with key...`);
  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: "Say hello" }],
      model: "gpt-4o-mini",
    });
    console.log("Response:", completion.choices[0].message.content);
  } catch (err) {
    console.error("OpenAI Error:", err.message);
  }
}

test();
