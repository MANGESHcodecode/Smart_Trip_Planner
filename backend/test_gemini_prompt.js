require('dotenv').config({ path: 'd:/tripyatra/backend/.env' });
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function test() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const modelName = "gemini-2.5-flash"; 
  const source = "Delhi", destination = "Mumbai", date = "2024-05-15";
  
  const prompt = `Generate a realistic Indian train schedule between ${source} and ${destination} for the date ${date}.
Provide 4-5 train options. Return ONLY a JSON object with this exact structure:
{
  "trains": [
    {
      "train_number": "Train Number (e.g. 12951)",
      "train_name": "Train Name (e.g. Mumbai Rajdhani)",
      "train_type": "Express, Rajdhani, Shatabdi, Superfast, Mail, Duronto, or Jan Shatabdi",
      "departure": "HH:MM",
      "arrival": "HH:MM",
      "duration": "Duration (e.g. 14h 55m)",
      "runs_on": ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
      "pantry": true,
      "distance_km": Distance in km (e.g. 1384),
      "classes": [
        { "name": "1A, 2A, 3A, SL, CC, etc", "fare": 1500 }
      ]
    }
  ]
}
Return only the valid JSON, no markdown formatting or extra text.`;

  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt + "\nIMPORTANT: Return ONLY valid JSON, no markdown formatting.");
    const text = result.response.text();
    console.log("Raw Response:\n", text);
    const cleanedJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanedJson);
    console.log("Parsed trains:", parsed.trains.length);
  } catch (err) {
    console.error("Gemini Error:", err.message);
  }
}

test();
