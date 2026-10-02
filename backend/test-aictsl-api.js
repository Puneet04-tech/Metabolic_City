import https from 'https';

async function testAICTSLAPI() {
  console.log('Testing AICTSL API without API key...\n');

  const endpoints = [
    { name: 'GetRouteWiseLiveBusTrips', method: 'POST', body: { routeId: 1 } },
    { name: 'GetBusTrackerDetails_test', method: 'POST', body: { busId: 1 } },
    { name: 'GetStationList', method: 'POST', body: {} },
    { name: 'GetNearByStationsListLatLong', method: 'POST', body: { latitude: 22.7196, longitude: 75.8577, radius: 5 } },
    { name: 'GetRoutesByFromToStation', method: 'POST', body: { sourceId: 1, destinationId: 2 } },
    { name: 'GetETATime', method: 'POST', body: { sourceId: 1, destinationId: 2 } },
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing: ${endpoint.name}`);
      
      const data = JSON.stringify(endpoint.body);
      
      const options = {
        hostname: 'aictslmobile.infinium.management',
        path: '/TransistService.svc/' + endpoint.name,
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        rejectUnauthorized: false, // Ignore SSL certificate errors
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          console.log(`  Status: ${res.statusCode}`);
          
          if (res.statusCode === 200) {
            try {
              const json = JSON.parse(responseData);
              console.log(`  Response: ${JSON.stringify(json, null, 2).substring(0, 300)}...`);
              console.log(`  ✅ SUCCESS - API works without key!\n`);
            } catch (e) {
              console.log(`  Response: ${responseData.substring(0, 300)}...`);
              console.log(`  ✅ SUCCESS - API returns data (non-JSON)\n`);
            }
          } else {
            console.log(`  Response: ${responseData.substring(0, 300)}...`);
            console.log(`  ❌ FAILED - Status ${res.statusCode}\n`);
          }
        });
      });

      req.on('error', (error) => {
        console.log(`  ❌ ERROR: ${error.message}\n`);
      });

      req.write(data);
      req.end();
      
      // Wait before next request
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.log(`  ❌ EXCEPTION: ${error.message}\n`);
    }
  }

  console.log('\n=== Test Complete ===');
  console.log('If any endpoints show SUCCESS (200), the API works without a key.');
  console.log('If all show FAILED, you may need to contact AICTSL for API access.');
}

testAICTSLAPI();
