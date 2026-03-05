import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testSync() {
  console.log('Testing ListTrac sync mutation directly...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/trpc/listtrac.syncListing?batch=1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'session=test'
      },
      body: JSON.stringify({
        0: {
          json: {
            listingId: 1,
            daysBack: 7
          }
        }
      })
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testSync();
