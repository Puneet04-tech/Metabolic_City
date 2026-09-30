async function testLoginAPI() {
  try {
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cityCode: 'CITY-IND-BPL8',
        role: 'operator',
        staffId: 'OP001',
        password: 'password123'
      })
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', data);
  } catch (error) {
    console.error('Error testing API:', error.message);
  }
}

testLoginAPI();
