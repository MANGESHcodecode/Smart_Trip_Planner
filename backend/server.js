require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 5000;

// ─── AI Client Initializations ────────────────────────────
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

let users = [];
let trips = [];
let tripIdCounter = 1;

// ─── Auth Middleware ──────────────────────────────────────
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    next();
  } catch { return res.status(403).json({ error: 'Invalid or expired token' }); }
}

// ════════════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════════════
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (users.find(u => u.email === email)) return res.status(400).json({ error: 'Email already registered' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = { id: Date.now(), name, email, password: hashedPassword, createdAt: new Date() };
    users.push(user);
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });
    res.status(201).json({ message: 'Account created!', token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = users.find(u => u.email === email);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });
    res.json({ message: 'Login successful', token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/auth/me', authenticateToken, (req, res) => res.json({ user: req.user }));

// ════════════════════════════════════════════════════════
//  TRIPS
// ════════════════════════════════════════════════════════
app.post('/api/trips', authenticateToken, (req, res) => {
  const { title, source, destination, date, travellers, budget, notes, itinerary, summary } = req.body;
  if (!source || !destination || !date) return res.status(400).json({ error: 'Source, destination and date required' });
  const trip = {
    id: tripIdCounter++,
    userId: req.user.id,
    title: title || `${source} to ${destination}`,
    source,
    destination,
    date,
    travellers: travellers || 1,
    budget: budget || '',
    notes: notes || '',
    itinerary: itinerary || null,
    summary: summary || null,
    status: 'planned',
    createdAt: new Date(),
    source_coords: getCoords(source).join(','),
    dest_coords: getCoords(destination).join(','),
  };
  trips.push(trip);
  res.status(201).json({ message: 'Trip saved!', trip });
});

app.get('/api/trips', authenticateToken, (req, res) => {
  const userTrips = trips.filter(t => t.userId === req.user.id)
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(t => ({
      ...t,
      source_coords: t.source_coords || getCoords(t.source).join(','),
      dest_coords: t.dest_coords || getCoords(t.destination).join(','),
    }));
  res.json({ trips: userTrips });
});

app.delete('/api/trips/:id', authenticateToken, (req, res) => {
  const idx = trips.findIndex(t => t.id === parseInt(req.params.id) && t.userId === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Trip not found' });
  trips.splice(idx, 1);
  res.json({ message: 'Trip deleted' });
});

// ════════════════════════════════════════════════════════
//  INDIANRAILAPI.COM CONFIG
//  Key format: rr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//  Base URL:   http://indianrailapi.com/api/v2/
// ════════════════════════════════════════════════════════
const RAIL_API_KEY  = process.env.RAIL_API_KEY;
const RAIL_BASE_URL = 'http://indianrailapi.com/api/v2';

// ── Station code lookup table (city name → IRCTC code) ──
// Covers all major Indian cities — no API call needed for these
const STATION_CODES = {
  // Maharashtra
  'MUMBAI':'CSTM', 'BOMBAY':'CSTM', 'MUMBAI CST':'CSTM', 'MUMBAI CENTRAL':'BCT',
  'BANDRA':'BDTS', 'DADAR':'DR', 'THANE':'TNA', 'PUNE':'PUNE', 'NAGPUR':'NGP',
  'NASHIK':'NK', 'AURANGABAD':'AWB', 'SOLAPUR':'SUR', 'KOLHAPUR':'KOP',
  'NANDED':'NED', 'LATUR':'LUR', 'AKOLA':'AK', 'AMRAVATI':'AMI',
  // Delhi / NCR
  'DELHI':'NDLS', 'NEW DELHI':'NDLS', 'OLD DELHI':'DLI', 'HAZRAT NIZAMUDDIN':'NZM',
  'GURGAON':'GGN', 'NOIDA':'NDLS', 'FARIDABAD':'FDB',
  // Rajasthan
  'JAIPUR':'JP', 'JODHPUR':'JU', 'UDAIPUR':'UDZ', 'AJMER':'AII',
  'KOTA':'KOTA', 'BIKANER':'BKN', 'ALWAR':'AWR',
  // UP / Uttarakhand
  'AGRA':'AGC', 'LUCKNOW':'LKO', 'VARANASI':'BSB', 'ALLAHABAD':'ALD',
  'KANPUR':'CNB', 'MATHURA':'MTJ', 'MEERUT':'MTC', 'GORAKHPUR':'GKP',
  'DEHRADUN':'DDN', 'HARIDWAR':'HW', 'RISHIKESH':'RISHIKESH',
  // Punjab / Haryana
  'AMRITSAR':'ASR', 'LUDHIANA':'LDH', 'CHANDIGARH':'CDG', 'AMBALA':'UMB',
  'PATHANKOT':'PTK', 'JALANDHAR':'JUC',
  // Gujarat
  'AHMEDABAD':'ADI', 'SURAT':'ST', 'VADODARA':'BRC', 'RAJKOT':'RJT',
  'BHAVNAGAR':'BVC', 'JAMNAGAR':'JAM',
  // Karnataka
  'BANGALORE':'SBC', 'BENGALURU':'SBC', 'MYSORE':'MYS', 'HUBLI':'UBL',
  'MANGALORE':'MAQ', 'BELGAUM':'BGM', 'GULBARGA':'GR',
  // Tamil Nadu
  'CHENNAI':'MAS', 'MADRAS':'MAS', 'COIMBATORE':'CBE', 'MADURAI':'MDU',
  'TRICHY':'TPJ', 'SALEM':'SA', 'TIRUNELVELI':'TEN', 'ERODE':'ED',
  // Kerala
  'KOCHI':'ERS', 'COCHIN':'ERS', 'TRIVANDRUM':'TVC', 'THIRUVANANTHAPURAM':'TVC',
  'KOZHIKODE':'CLT', 'CALICUT':'CLT', 'THRISSUR':'TCR', 'KANNUR':'CAN',
  // Andhra / Telangana
  'HYDERABAD':'HYB', 'SECUNDERABAD':'SC', 'VISAKHAPATNAM':'VSKP',
  'VIJAYAWADA':'BZA', 'TIRUPATI':'TPTY', 'GUNTUR':'GNT', 'WARANGAL':'WL',
  // West Bengal
  'KOLKATA':'KOAA', 'CALCUTTA':'KOAA', 'HOWRAH':'HWH', 'SEALDAH':'SDAH',
  'DURGAPUR':'DGR', 'ASANSOL':'ASN', 'SILIGURI':'SGUJ',
  // Bihar / Jharkhand
  'PATNA':'PNBE', 'GAYA':'GAYA', 'RANCHI':'RNC', 'JAMSHEDPUR':'TATA',
  'DHANBAD':'DHN', 'MUZAFFARPUR':'MFP', 'BHAGALPUR':'BGP',
  // Odisha
  'BHUBANESWAR':'BBS', 'CUTTACK':'CTC', 'PURI':'PURI',
  // Northeast / Others
  'GUWAHATI':'GHY', 'BHOPAL':'BPL', 'INDORE':'INDB', 'JABALPUR':'JBP',
  'RAIPUR':'R', 'BILASPUR':'BSP', 'GOA':'MAO', 'MARGAO':'MAO', 'PANAJI':'MAO',
  'JAMMU':'JAT', 'SHIMLA':'SML', 'SRINAGAR':'SVDK',
};

// ── Station coordinates lookup table (city name → [lat, lng]) ──
const STATION_COORDS = {
  'MUMBAI': [19.0760, 72.8777], 'BOMBAY': [19.0760, 72.8777],
  'DELHI': [28.6139, 77.2090], 'NEW DELHI': [28.6139, 77.2090],
  'KOLKATA': [22.5726, 88.3639], 'CALCUTTA': [22.5726, 88.3639],
  'CHENNAI': [13.0827, 80.2707], 'MADRAS': [13.0827, 80.2707],
  'BANGALORE': [12.9716, 77.5946], 'BENGALURU': [12.9716, 77.5946],
  'HYDERABAD': [17.3850, 78.4867], 'PUNE': [18.5204, 73.8567],
  'JAIPUR': [26.9124, 75.7873], 'LUCKNOW': [26.8467, 80.9462],
  'AHMEDABAD': [23.0225, 72.5714], 'GOA': [15.2993, 74.1240],
  'VARANASI': [25.3176, 82.9739], 'NAGPUR': [21.1458, 79.0882],
  'PATNA': [25.5941, 85.1376], 'BHOPAL': [23.2599, 77.4126],
  'SURAT': [21.1702, 72.8311], 'KOCHI': [9.9312, 76.2673],
  'AGRA': [27.1767, 78.0081], 'AMRITSAR': [31.6340, 74.8723],
  'CHANDIGARH': [30.7333, 76.7794], 'COIMBATORE': [11.0168, 76.9558],
};

function getCoords(cityName) {
  const upper = cityName.toUpperCase().trim();
  return STATION_COORDS[upper] || [20.5937, 78.9629]; // fallback: center of India
}

// Convert city name to station code
function getStationCode(cityName) {
  const upper = cityName.toUpperCase().trim();
  return STATION_CODES[upper] || upper.slice(0, 4); // fallback: first 4 chars
}

// ── Call indianrailapi.com ────────────────────────────────
async function callRailAPI(endpoint) {
  const url = `${RAIL_BASE_URL}/${endpoint}`;
  console.log('RailAPI call:', url.replace(RAIL_API_KEY, '***'));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`RailAPI HTTP ${res.status}`);
  const data = await res.json();
  if (data.ResponseCode !== '200') throw new Error(`RailAPI error: ${data.Message || data.ResponseCode}`);
  return data;
}

// ── Transform RailAPI train response to our format ────────
function transformTrains(apiTrains, srcName, dstName, srcCode, dstCode) {
  if (!Array.isArray(apiTrains)) return [];
  return apiTrains.map(t => {
    // Parse travel time like "02:30H" → "2h 30m"
    let duration = t.TravelTime || '';
    duration = duration.replace('H', '').trim();
    if (duration.includes(':')) {
      const [h, m] = duration.split(':');
      duration = `${parseInt(h)}h ${m}m`;
    }

    // Determine train type from name / type code
    const tname = (t.TrainName || '').toUpperCase();
    let train_type = 'Express';
    if (t.TrainType === 'RAJ' || tname.includes('RAJDHANI')) train_type = 'Rajdhani';
    else if (t.TrainType === 'SHTBDI' || tname.includes('SHATABDI')) train_type = 'Shatabdi';
    else if (t.TrainType === 'SF' || tname.includes('SUPERFAST')) train_type = 'Superfast';
    else if (t.TrainType === 'MAL' || tname.includes('MAIL')) train_type = 'Mail';
    else if (t.TrainType === 'DRT' || tname.includes('DURONTO')) train_type = 'Duronto';
    else if (t.TrainType === 'JAN' || tname.includes('JAN SHATABDI')) train_type = 'Jan Shatabdi';
    else if (t.TrainType === 'GR' || tname.includes('GARIB RATH')) train_type = 'Garib Rath';

    // Realistic fares based on train type
    const fareMap = {
      'Rajdhani':   [{name:'1A',fare:4200},{name:'2A',fare:2500},{name:'3A',fare:1720}],
      'Duronto':    [{name:'1A',fare:3800},{name:'2A',fare:2240},{name:'3A',fare:1540}],
      'Shatabdi':   [{name:'EC',fare:1600},{name:'CC',fare:720}],
      'Jan Shatabdi':[{name:'CC',fare:650},{name:'2S',fare:240}],
      'Superfast':  [{name:'2A',fare:1800},{name:'3A',fare:1230},{name:'SL',fare:445}],
      'Mail':       [{name:'2A',fare:1680},{name:'3A',fare:1148},{name:'SL',fare:415}],
      'Garib Rath': [{name:'3A',fare:1050}],
      'Express':    [{name:'2A',fare:1540},{name:'3A',fare:1052},{name:'SL',fare:380}],
    };
    const baseClasses = fareMap[train_type] || fareMap['Express'];
    const classes = baseClasses.map(c => ({
      name: c.name,
      fare: c.fare,
      available: Math.floor(Math.random() * 160) > 40 ? Math.floor(Math.random() * 180) + 10 : 0
    }));

    return {
      train_number:     t.TrainNo || t.TrainNumber || '',
      train_name:       toTitleCase(t.TrainName || ''),
      train_type,
      source:           srcName,
      source_code:      t.Source || srcCode,
      destination:      dstName,
      destination_code: t.Destination || dstCode,
      departure:        t.DepartureTime || '--:--',
      arrival:          t.ArrivalTime   || '--:--',
      duration,
      runs_on:          ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
      classes,
      pantry:           ['Rajdhani','Duronto','Shatabdi'].includes(train_type),
      distance_km:      null,
      source_coords:    getCoords(srcName).join(','),
      dest_coords:      getCoords(dstName).join(','),
    };
  });
}

function toTitleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// ════════════════════════════════════════════════════════
//  TRAIN SEARCH — Live data from indianrailapi.com
// ════════════════════════════════════════════════════════
app.post('/api/trains/search', authenticateToken, async (req, res) => {
  const { source, destination, date, travellers = 1 } = req.body;
  if (!source || !destination || !date)
    return res.status(400).json({ error: 'Source, destination and date required' });

  console.log('\n=== Train Search ===');
  console.log('Input:', source, '->', destination, '|', date);

  const srcCode = getStationCode(source);
  const dstCode = getStationCode(destination);
  console.log('Station codes:', srcCode, '->', dstCode);

  // ── Step 1: Try indianrailapi.com live API ────────────
  if (RAIL_API_KEY) {
    try {
      const data = await callRailAPI(
        `TrainBetweenStation/apikey/${RAIL_API_KEY}/From/${srcCode}/To/${dstCode}`
      );

      console.log('RailAPI response code:', data.ResponseCode);
      console.log('Total trains found:', data.TotalTrains);

      if (data.Trains && data.Trains.length > 0) {
        const trains = transformTrains(data.Trains, source, destination, srcCode, dstCode);
        console.log('✅ RailAPI returned', trains.length, 'trains');
        return res.json({
          trains,
          source,
          destination,
          date,
          travellers,
          dataSource: 'indianrailapi',
          totalFound: data.TotalTrains,
          srcCode,
          dstCode,
        });
      } else {
        console.log('No trains found for this route in RailAPI, trying fallback...');
      }
    } catch (err) {
      console.error('RailAPI error:', err.message);
    }
  } else {
    console.warn('RAIL_API_KEY not set in .env');
  }

  // ── Step 2: Fallback to our verified route database ───
  const dbTrains = lookupRouteDB(source, destination);
  if (dbTrains && dbTrains.length > 0) {
    console.log('Using route DB fallback:', dbTrains.length, 'trains');
    return res.json({ trains: dbTrains, source, destination, date, travellers, dataSource: 'database', srcCode, dstCode });
  }

  // ── Step 3: Generic demo trains ───────────────────────
  console.log('Using generic demo fallback');
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const fallback = [
    { train_number:'12001', train_name:`${source} ${destination} Superfast`, train_type:'Superfast', source, source_code:srcCode, destination, destination_code:dstCode, departure:'06:30', arrival:'14:00', duration:'7h 30m', runs_on:days, classes:[{name:'2A',fare:1680,available:24},{name:'3A',fare:1148,available:72},{name:'SL',fare:415,available:180}], pantry:true, distance_km:600 },
    { train_number:'12002', train_name:`${source} Rajdhani Express`,         train_type:'Rajdhani',  source, source_code:srcCode, destination, destination_code:dstCode, departure:'17:00', arrival:'07:00', duration:'14h 00m', runs_on:days, classes:[{name:'1A',fare:3960,available:6},{name:'2A',fare:2340,available:28},{name:'3A',fare:1608,available:0}], pantry:true, distance_km:600 },
    { train_number:'12003', train_name:`${destination} Mail`,                train_type:'Mail',      source, source_code:srcCode, destination, destination_code:dstCode, departure:'22:00', arrival:'09:30', duration:'11h 30m', runs_on:days, classes:[{name:'2A',fare:1540,available:10},{name:'3A',fare:1052,available:48},{name:'SL',fare:380,available:145}], pantry:false, distance_km:600 },
    { train_number:'12004', train_name:`${source} ${destination} Express`,   train_type:'Express',   source, source_code:srcCode, destination, destination_code:dstCode, departure:'08:00', arrival:'17:30', duration:'9h 30m',  runs_on:days.slice(0,5), classes:[{name:'3A',fare:1020,available:55},{name:'SL',fare:368,available:200}], pantry:false, distance_km:600 },
  ];
  res.json({ trains: fallback, source, destination, date, travellers, dataSource: 'demo', srcCode, dstCode });
});

// ── Station code search endpoint (for autocomplete) ──────
app.get('/api/stations/search', authenticateToken, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });
  if (!RAIL_API_KEY) return res.json({ stations: [] });
  try {
    const data = await callRailAPI(`AutoCompleteStation/apikey/${RAIL_API_KEY}/StationName/${encodeURIComponent(q)}`);
    res.json({ stations: data.Stations || data.Station || [] });
  } catch (err) {
    console.error('Station search error:', err.message);
    res.json({ stations: [] });
  }
});

// ════════════════════════════════════════════════════════
//  ROUTE DATABASE FALLBACK (verified real trains)
// ════════════════════════════════════════════════════════
const ROUTE_DB = {
  'MUMBAI|PUNE': [
    { n:'12127',name:'Intercity Express',   type:'Intercity', dep:'06:35',arr:'09:45',dur:'3h 10m',km:192,pantry:false,cls:[{n:'CC',f:245,a:110},{n:'2S',f:90,a:200}],         days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
    { n:'12123',name:'Deccan Queen',         type:'Superfast', dep:'17:10',arr:'20:25',dur:'3h 15m',km:192,pantry:true, cls:[{n:'FC',f:485,a:30},{n:'CC',f:265,a:85},{n:'2S',f:95,a:180}], days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
    { n:'11007',name:'Deccan Express',       type:'Express',   dep:'07:15',arr:'11:00',dur:'3h 45m',km:197,pantry:false,cls:[{n:'SL',f:175,a:220},{n:'2S',f:80,a:300}],        days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
    { n:'12125',name:'Pragati Express',      type:'Express',   dep:'05:55',arr:'08:55',dur:'3h 00m',km:192,pantry:false,cls:[{n:'CC',f:240,a:95},{n:'2S',f:88,a:160}],         days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
  ],
  'MUMBAI|DELHI': [
    { n:'12951',name:'Mumbai Rajdhani',      type:'Rajdhani',  dep:'17:40',arr:'08:35',dur:'14h 55m',km:1384,pantry:true, cls:[{n:'1A',f:4560,a:8},{n:'2A',f:2680,a:32},{n:'3A',f:1850,a:0}], days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
    { n:'12137',name:'Punjab Mail',          type:'Mail',      dep:'19:35',arr:'10:55',dur:'15h 20m',km:1541,pantry:false,cls:[{n:'1A',f:3740,a:6},{n:'2A',f:2180,a:22},{n:'3A',f:1490,a:88},{n:'SL',f:540,a:180}], days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
    { n:'12953',name:'August Kranti Raj.',   type:'Rajdhani',  dep:'17:40',arr:'10:55',dur:'17h 15m',km:1384,pantry:true, cls:[{n:'1A',f:4780,a:4},{n:'2A',f:2820,a:18},{n:'3A',f:1960,a:45}], days:['Mon','Wed','Fri'] },
  ],
  'MUMBAI|NAGPUR': [
    { n:'12289',name:'Nagpur Duronto',       type:'Duronto',   dep:'22:00',arr:'09:40',dur:'11h 40m',km:836,pantry:true, cls:[{n:'1A',f:3280,a:5},{n:'2A',f:1960,a:28},{n:'3A',f:1340,a:64}], days:['Mon','Wed','Fri'] },
    { n:'11039',name:'Maharashtra Express',  type:'Express',   dep:'21:20',arr:'11:25',dur:'14h 05m',km:873,pantry:false,cls:[{n:'2A',f:1640,a:18},{n:'3A',f:1120,a:72},{n:'SL',f:405,a:195}], days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
    { n:'12105',name:'Vidarbha Express',     type:'Express',   dep:'06:00',arr:'18:45',dur:'12h 45m',km:836,pantry:false,cls:[{n:'2A',f:1580,a:14},{n:'3A',f:1080,a:56},{n:'SL',f:390,a:0}],  days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
  ],
  'PUNE|NAGPUR': [
    { n:'12135',name:'Pune Nagpur Express',  type:'Express',   dep:'17:55',arr:'07:05',dur:'13h 10m',km:671,pantry:false,cls:[{n:'2A',f:1480,a:20},{n:'3A',f:1010,a:78},{n:'SL',f:365,a:185}], days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
    { n:'12297',name:'Pune Ahmedabad Exp',   type:'Express',   dep:'21:55',arr:'12:30',dur:'14h 35m',km:671,pantry:false,cls:[{n:'2A',f:1520,a:12},{n:'3A',f:1040,a:54},{n:'SL',f:375,a:140}], days:['Mon','Wed','Fri','Sun'] },
    { n:'11025',name:'Bhusawal Express',     type:'Express',   dep:'23:40',arr:'14:15',dur:'14h 35m',km:735,pantry:false,cls:[{n:'SL',f:355,a:0},{n:'3A',f:980,a:36}],         days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
  ],
  'DELHI|KOLKATA': [
    { n:'12301',name:'Howrah Rajdhani',      type:'Rajdhani',  dep:'16:55',arr:'09:55',dur:'17h 00m',km:1441,pantry:true, cls:[{n:'1A',f:5020,a:6},{n:'2A',f:2960,a:24},{n:'3A',f:2040,a:78}], days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
    { n:'12303',name:'Poorva Express',       type:'Superfast', dep:'08:00',arr:'06:20',dur:'22h 20m',km:1531,pantry:false,cls:[{n:'2A',f:2280,a:16},{n:'3A',f:1560,a:60},{n:'SL',f:570,a:160}], days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
  ],
  'BANGALORE|CHENNAI': [
    { n:'12007',name:'Shatabdi Express',     type:'Shatabdi',  dep:'06:00',arr:'11:00',dur:'5h 00m',km:362,pantry:true, cls:[{n:'EC',f:1380,a:18},{n:'CC',f:685,a:72}],         days:['Mon','Tue','Wed','Thu','Fri','Sat'] },
    { n:'12657',name:'KSR Bengaluru Mail',   type:'Mail',      dep:'20:40',arr:'04:10',dur:'7h 30m',km:362,pantry:false,cls:[{n:'2A',f:1460,a:20},{n:'3A',f:1000,a:58},{n:'SL',f:360,a:150}], days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
  ],
  'DELHI|JAIPUR': [
    { n:'12015',name:'Ajmer Shatabdi',       type:'Shatabdi',  dep:'06:05',arr:'10:40',dur:'4h 35m',km:308,pantry:true, cls:[{n:'EC',f:1200,a:14},{n:'CC',f:540,a:68}],         days:['Mon','Tue','Wed','Thu','Fri','Sat'] },
    { n:'12413',name:'Ajmer Rajdhani',       type:'Rajdhani',  dep:'19:50',arr:'00:15',dur:'4h 25m',km:308,pantry:true, cls:[{n:'1A',f:2680,a:6},{n:'2A',f:1580,a:22},{n:'3A',f:1080,a:64}], days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
  ],
  'MUMBAI|GOA': [
    { n:'10103',name:'Mandovi Express',      type:'Express',   dep:'07:10',arr:'18:00',dur:'10h 50m',km:593,pantry:false,cls:[{n:'2A',f:1420,a:16},{n:'3A',f:968,a:58},{n:'SL',f:348,a:180}], days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
    { n:'12051',name:'Jan Shatabdi Exp',     type:'Shatabdi',  dep:'05:25',arr:'15:00',dur:'9h 35m',km:593,pantry:true, cls:[{n:'CC',f:720,a:45},{n:'2S',f:265,a:140}],         days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
    { n:'10111',name:'Konkan Kanya Exp',     type:'Express',   dep:'22:45',arr:'11:10',dur:'12h 25m',km:593,pantry:false,cls:[{n:'2A',f:1340,a:22},{n:'3A',f:912,a:76},{n:'SL',f:328,a:200}], days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
  ],
};

function lookupRouteDB(src, dst) {
  const s = src.toUpperCase().trim();
  const d = dst.toUpperCase().trim();
  const found = ROUTE_DB[`${s}|${d}`] || ROUTE_DB[`${d}|${s}`];
  const rev   = !ROUTE_DB[`${s}|${d}`] && !!ROUTE_DB[`${d}|${s}`];
  if (!found) return null;
  return found.map(t => ({
    train_number:    t.n,
    train_name:      t.name,
    train_type:      t.type,
    source:          rev ? dst : src,
    source_code:     getStationCode(rev ? dst : src),
    destination:     rev ? src : dst,
    destination_code:getStationCode(rev ? src : dst),
    departure:       rev ? t.arr : t.dep,
    arrival:         rev ? t.dep : t.arr,
    duration:        t.dur,
    runs_on:         t.days,
    classes:         t.cls.map(c => ({ name:c.n, fare:c.f, available:c.a })),
    pantry:          t.pantry,
    distance_km:     t.km,
    source_coords:   getCoords(rev ? dst : src).join(','),
    dest_coords:     getCoords(rev ? src : dst).join(','),
  }));
}

// ════════════════════════════════════════════════════════
//  PACKAGES & ITINERARY
// ════════════════════════════════════════════════════════
const PACKAGES = [
  { id: 1, name: 'Golden Triangle', cities: ['Delhi', 'Agra', 'Jaipur'], duration: '5 Days', price: 15000, image: '🏯', description: 'Explore the heritage of North India.' },
  { id: 2, name: 'God\'s Own Country', cities: ['Kochi', 'Munnar', 'Alleppey'], duration: '6 Days', price: 18000, image: '🌴', description: 'Experience the backwaters and hills of Kerala.' },
  { id: 3, name: 'Royal Rajasthan', cities: ['Jaipur', 'Jodhpur', 'Udaipur'], duration: '7 Days', price: 22000, image: '🏰', description: 'A journey through the land of Maharajas.' },
  { id: 4, name: 'Himalayan Escape', cities: ['Chandigarh', 'Shimla', 'Manali'], duration: '6 Days', price: 14000, image: '🏔️', description: 'Snow-capped peaks and serene valleys.' },
  { id: 5, name: 'Goa Beach Party', cities: ['Goa'], duration: '4 Days', price: 12000, image: '🏖️', description: 'Sun, sand, and non-stop fun.' },
  { id: 6, name: 'Spiritual Varanasi', cities: ['Varanasi', 'Lucknow'], duration: '4 Days', price: 10000, image: '🪔', description: 'The oldest living city in the world.' },
];

app.get('/api/packages', (req, res) => {
  res.json({ packages: PACKAGES });
});

app.post('/api/itinerary/generate', authenticateToken, async (req, res) => {
  const { packageId, budget, travellers, accommodation, days, source, destination } = req.body;
  const pkg = PACKAGES.find(p => p.id === packageId);
  if (!pkg && !source && !destination) return res.status(400).json({ error: 'Package or Source/Destination required' });

  const finalDest = pkg ? pkg.cities[pkg.cities.length - 1] : destination;
  const finalSrc = source || 'Mumbai';
  const tripDays = days || (pkg ? parseInt(pkg.duration) : 3);

  const prompt = `Generate a highly detailed, varied, and location-specific Indian travel itinerary for a trip from ${finalSrc} to ${finalDest}.
      
  Trip Details:
  - Duration: ${tripDays} days
  - Budget: ₹${budget} total for ${travellers} person(s)
  - Accommodation: ${accommodation}
  - Travelers: ${travellers}
  ${pkg ? `- This is based on the "${pkg.name}" package which includes: ${pkg.cities.join(', ')}` : ''}

  Instructions:
  1. Each day MUST have unique and realistic activities specific to the cities being visited.
  2. Do NOT repeat the same activities (like "Breakfast at Hotel") for every day in the same way; vary the descriptions.
  3. Include specific famous landmarks, local eateries, and cultural experiences relevant to ${finalDest}${pkg ? ' and ' + pkg.cities.join(', ') : ''}.
  4. Ensure the transport suggestion is logical for the distance between ${finalSrc} and ${finalDest}.

  Return ONLY a JSON object with this exact structure:
  {
    "suggestedTransport": "Flight or Train",
    "transportReason": "Short specific explanation based on distance and budget",
    "itinerary": [
      {
        "day": 1,
        "title": "Day 1: [Specific Title for Day 1]",
        "events": [
          { "time": "08:30 AM", "activity": "[Detailed specific activity]" },
          { "time": "11:00 AM", "activity": "[Specific landmark visit]" },
          { "time": "01:30 PM", "activity": "[Lunch at a specific type of local place]" },
          { "time": "04:30 PM", "activity": "[Afternoon specific experience]" },
          { "time": "08:00 PM", "activity": "[Dinner recommendation]" }
        ]
      }
    ]
  }`;

  // 1. Try OpenAI First
  if (process.env.OPENAI_API_KEY) {
    try {
      console.log(`[AI] Attempting OpenAI Itinerary for: ${finalSrc} -> ${finalDest}`);
      const completion = await openai.chat.completions.create({
        messages: [
          { role: "system", content: "You are a professional Indian travel consultant who provides highly detailed and unique travel plans. You always return valid JSON." },
          { role: "user", content: prompt }
        ],
        model: "gpt-4o-mini",
        response_format: { type: "json_object" }
      });

      const aiData = JSON.parse(completion.choices[0].message.content);
      console.log("[AI] OpenAI Itinerary generated successfully");
      
      return res.json({
        summary: {
          source: finalSrc, destination: finalDest, days: tripDays, travellers, budget, accommodation,
          suggestedTransport: aiData.suggestedTransport, transportReason: aiData.transportReason, isAI: true, provider: 'OpenAI'
        },
        itinerary: aiData.itinerary
      });
    } catch (err) {
      console.error('[AI] OpenAI Error:', err.message);
    }
  }

  // 2. Try Gemini (Free Tier) Second
  if (genAI) {
    const geminiModels = [
      "gemini-1.5-flash", 
      "gemini-1.5-flash-latest",
      "gemini-pro", 
      "gemini-1.0-pro"
    ];
    for (const modelName of geminiModels) {
      try {
        console.log(`[AI] Attempting Gemini Itinerary with model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        
        const result = await model.generateContent(prompt + "\nIMPORTANT: Return ONLY valid JSON, no markdown formatting.");
        const text = result.response.text();
        
        const cleanedJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const aiData = JSON.parse(cleanedJson);
        
        console.log(`[AI] Gemini (${modelName}) Itinerary generated successfully`);

        return res.json({
          summary: {
            source: finalSrc, destination: finalDest, days: tripDays, travellers, budget, accommodation,
            suggestedTransport: aiData.suggestedTransport, transportReason: aiData.transportReason, isAI: true, provider: `Gemini (${modelName})`
          },
          itinerary: aiData.itinerary
        });
      } catch (err) {
        console.warn(`[AI] Gemini model ${modelName} failed:`, err.message);
      }
    }
    console.error('[AI] All Gemini models failed.');
  }

  // Fallback Manual Logic (More Dynamic)
  let transport = 'Train';
  let transportReason = 'Budget-friendly and scenic.';
  if (budget / travellers > 10000) {
    transport = 'Flight';
    transportReason = 'Faster and fits your premium budget.';
  }

  const activityPool = [
    [
      { time: '09:00 AM', activity: 'Breakfast at a local heritage cafe' },
      { time: '11:00 AM', activity: 'Visit to the most famous local landmark/monument' },
      { time: '01:30 PM', activity: 'Lunch at a highly-rated traditional restaurant' },
      { time: '04:00 PM', activity: 'Exploring the local markets and shopping for souvenirs' },
      { time: '08:00 PM', activity: 'Dinner featuring regional specialties' }
    ],
    [
      { time: '08:30 AM', activity: 'Morning walk through a scenic park or garden' },
      { time: '10:30 AM', activity: 'Visit to a local museum or art gallery' },
      { time: '01:00 PM', activity: 'Quick lunch at a popular street food hub' },
      { time: '03:30 PM', activity: 'Guided tour of historical sites or spiritual places' },
      { time: '07:30 PM', activity: 'Evening cultural show or light & sound performance' }
    ],
    [
      { time: '09:30 AM', activity: 'Leisurely breakfast and local area exploration' },
      { time: '11:30 AM', activity: 'Visit to nearby architectural wonders' },
      { time: '02:00 PM', activity: 'Relaxing lunch with a view' },
      { time: '04:30 PM', activity: 'Photography session at scenic viewpoints' },
      { time: '08:30 PM', activity: 'Fine dining experience at a top-rated hotel' }
    ],
    [
      { time: '08:00 AM', activity: 'Early morning excursion to outskirts or nature spots' },
      { time: '11:00 AM', activity: 'Workshop or interaction with local artisans' },
      { time: '01:30 PM', activity: 'Authentic home-style meal at a local\'s place' },
      { time: '04:00 PM', activity: 'Boating or evening stroll by the riverside/lake' },
      { time: '07:00 PM', activity: 'Casual dinner and packing for the next day' }
    ]
  ];

  const itinerary = [];
  for (let i = 1; i <= tripDays; i++) {
    const dayCity = pkg ? pkg.cities[(i - 1) % pkg.cities.length] : finalDest;
    const activities = activityPool[(i - 1) % activityPool.length];
    
    itinerary.push({
      day: i,
      title: `Day ${i}: ${i === 1 ? 'Arrival & ' : ''}Exploring ${dayCity}`,
      events: activities.map(e => ({ ...e }))
    });
  }

  res.json({
    summary: {
      source: finalSrc,
      destination: finalDest,
      days: tripDays,
      travellers,
      budget,
      accommodation,
      suggestedTransport: transport,
      transportReason,
      isAI: false // Mark as fallback
    },
    itinerary
  });
});

// ── Flight Search Simulation ──────────────────────────────
app.post('/api/flights/search', authenticateToken, (req, res) => {
  const { source, destination, date } = req.body;
  const airlines = ['IndiGo', 'Air India', 'Vistara', 'Akasa Air', 'SpiceJet'];
  const flights = Array.from({ length: 5 }).map((_, i) => ({
    flight_number: `6E-${100 + i}`,
    airline: airlines[i],
    source,
    destination,
    departure: `${10 + i}:00`,
    arrival: `${12 + i}:30`,
    duration: '2h 30m',
    price: 4500 + (i * 800),
    available_seats: 10 + (i * 5)
  }));
  res.json({ flights });
});

// HEALTH
app.get('/api/health', (req, res) => {
  res.json({
    status:            'ok',
    rail_api_key_set:  !!RAIL_API_KEY,
    rail_api_key_preview: RAIL_API_KEY ? RAIL_API_KEY.substring(0,12)+'...' : 'NOT SET',
    openai_key_set:    !!process.env.OPENAI_API_KEY,
    gemini_key_set:    !!process.env.GEMINI_API_KEY,
    users:             users.length,
    trips:             trips.length,
    routes_in_db:      Object.keys(ROUTE_DB).length,
    station_codes:     Object.keys(STATION_CODES).length,
    packages_count:    PACKAGES.length
  });
});

app.listen(PORT, () => {
  console.log(`\n🚂 TripYatra running → http://localhost:${PORT}`);
  console.log(`🔑 Rail API key: ${RAIL_API_KEY ? RAIL_API_KEY.substring(0,12)+'...' : 'NOT SET'}`);
  console.log(`📡 Health → http://localhost:${PORT}/api/health\n`);
});
