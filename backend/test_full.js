const http = require('http');

async function testFull() {
  console.log('Testing full flow...');

  try {
    // 1. Register a test user
    const regRes = await fetch('http://localhost:5001/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User', email: `test${Date.now()}@test.com`, password: 'password123' })
    });
    
    const regData = await regRes.json();
    if (!regRes.ok) throw new Error('Reg Failed: ' + JSON.stringify(regData));
    console.log('Registered successfully. Token:', regData.token.substring(0, 15) + '...');

    const token = regData.token;

    // 2. Search Trains
    console.log('Searching trains using API...');
    const searchRes = await fetch('http://localhost:5001/api/trains/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        source: 'Delhi',
        destination: 'Mumbai',
        date: '2024-05-15',
        travellers: 1
      })
    });
    
    const searchData = await searchRes.json();
    console.log(`DataSource: ${searchData.dataSource}`);
    if (searchData.trains) {
      console.log(`Found ${searchData.trains.length} trains.`);
    } else {
      console.log(searchData);
    }
  } catch(e) {
    console.error('Test Full Error:', e.message);
  }
}

testFull();
