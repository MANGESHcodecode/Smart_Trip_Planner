require('dotenv').config({ path: 'd:/tripyatra/backend/.env' });
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function test() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const modelName = "gemini-2.5-flash"; // testing as the user asked
  console.log(`Testing Gemini with key: ${process.env.GEMINI_API_KEY}`);
  console.log(`Using model: ${modelName}`);
  
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const prompt = "Say hello";
    const result = await model.generateContent(prompt);
    console.log("Response:", result.response.text());
  } catch (err) {
    console.error("Gemini Error:", err.message);
  }
}

test();
