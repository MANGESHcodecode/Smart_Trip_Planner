# 🚂 TripYatra — Smart India Trip Planner
**Full Stack Web Project** | Node.js + Express + HTML/CSS/JS + OpenAI

---

## 📁 Project Structure

```
tripyatra/
├── backend/
│   ├── server.js          ← Express API server (all routes here)
│   ├── package.json       ← Backend dependencies
│   └── .env               ← API keys (NEVER commit this)
│
└── frontend/
    └── public/
        ├── index.html     ← Landing page
        ├── login.html     ← Login page
        ├── register.html  ← Register page
        ├── dashboard.html ← Main dashboard (protected)
        ├── plan-trip.html ← Trip planner + AI train search
        ├── train-search.html ← Standalone train search
        ├── my-trips.html  ← View/delete saved trips
        ├── explore.html   ← Explore Indian destinations
        ├── styles.css     ← Global CSS
        └── app.js         ← Shared JS (auth, API client, toast)
```

---

## ⚙️ STEP-BY-STEP SETUP IN VS CODE

### Step 1 — Open the project in VS Code
```
Open VS Code → File → Open Folder → select the `tripyatra` folder
```

### Step 2 — Install Node.js (if not already)
1. Go to https://nodejs.org and download the LTS version
2. Install it with default settings
3. Verify: open VS Code terminal (`Ctrl + `` ` ``) and type:
   ```
   node --version
   ```
   You should see something like `v20.x.x`

### Step 3 — Install backend dependencies
In the VS Code terminal:
```bash
cd backend
npm install
```
This installs: express, cors, bcryptjs, jsonwebtoken, dotenv, openai, nodemon

### Step 4 — Add your OpenAI API Key
1. Open `backend/.env`
2. Replace `your_openai_api_key_here` with your actual key:
   ```
   OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx
   ```
3. Change the JWT secret too:
   ```
   JWT_SECRET=mytripsecret2024supersecure
   ```

> **Get OpenAI Key:** Go to https://platform.openai.com/api-keys → Create new key
> The free tier gives you $5 credit — enough for hundreds of searches

### Step 5 — Start the backend server
```bash
# Make sure you're in the backend/ folder
npm run dev
```
You should see:
```
🚂 TripYatra backend running on http://localhost:5000
```
Leave this terminal open.

### Step 6 — Open the frontend
Open a **second terminal** in VS Code (`+` button in terminal panel):
```bash
cd frontend/public
```

**Option A — Use Live Server (Recommended for development):**
1. Install the "Live Server" extension in VS Code (search in Extensions panel)
2. Right-click `index.html` → "Open with Live Server"
3. Your browser opens at `http://127.0.0.1:5500`

**Option B — Serve with Node:**
```bash
# In frontend/public folder
npx serve .
```
Then open http://localhost:3000

### Step 7 — Test the app
1. Go to `http://localhost:5500` (or your Live Server URL)
2. Click "Get Started Free" → Register an account
3. You'll be redirected to the Dashboard
4. Click "Plan a Trip" → Enter Mumbai → Delhi → Search Trains
5. OpenAI will return train data in ~3-5 seconds!

---

## 🔌 API Endpoints Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login, get JWT token |
| GET | `/api/auth/me` | Yes | Get current user |
| GET | `/api/trips` | Yes | Get all user trips |
| POST | `/api/trips` | Yes | Create new trip |
| DELETE | `/api/trips/:id` | Yes | Delete a trip |
| POST | `/api/trains/search` | Yes | AI train search |
| GET | `/api/health` | No | Check server status |

---

## 🧪 Testing the API directly (Postman or curl)

**Register:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@test.com","password":"test123"}'
```

**Train Search (replace TOKEN):**
```bash
curl -X POST http://localhost:5000/api/trains/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"source":"Mumbai","destination":"Delhi","date":"2025-03-20","travellers":2}'
```

---

## 🎯 Features Implemented

- ✅ User Registration & Login with password hashing (bcrypt)
- ✅ JWT-based authentication & session management
- ✅ Protected routes — redirect to login if not authenticated
- ✅ Dashboard with stats (trips, searches, upcoming, cities)
- ✅ Plan Trip — form → OpenAI fetches train details
- ✅ IRCTC-style train cards (name, number, departure, arrival, duration, classes, fares)
- ✅ Save trips to user account
- ✅ My Trips — view, filter (upcoming/past), delete
- ✅ Train Search — standalone page
- ✅ Explore India — 12 destinations with travel info
- ✅ Toast notifications for all actions
- ✅ Responsive design (mobile-friendly)
- ✅ Auto-redirect: logged-in → dashboard, logged-out → login

---

## 🚀 Common Issues & Fixes

**"Failed to fetch" error:**
→ Make sure backend is running (`npm run dev` in backend folder)
→ Check that backend says "running on http://localhost:5000"

**"OpenAI API error":**
→ Check your API key in `backend/.env`
→ Make sure you have credits at https://platform.openai.com/usage

**Login redirects loop:**
→ Open browser DevTools → Application → Local Storage → Clear all `tripyatra_*` items

**Port already in use:**
→ Change `PORT=5000` in `.env` to `PORT=5001`

---

## 📝 Course Submission Notes

This project demonstrates:
1. **Frontend** — HTML5, CSS3 (custom properties, animations), Vanilla JS
2. **Backend** — Node.js, Express.js REST API
3. **Authentication** — JWT tokens, bcrypt password hashing, session management
4. **API Integration** — OpenAI API (GPT-4o-mini) for AI train data
5. **CRUD Operations** — Create/Read/Delete trips
6. **Full Stack Flow** — Frontend ↔ Backend ↔ External API
