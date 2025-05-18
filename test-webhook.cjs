// A simple script to test the Twilio webhook endpoint locally
// Run with: node test-webhook-cjs.js

const axios = require('axios');
const querystring = require('querystring');

// Simulate a Twilio webhook request
async function testWebhook() {
  console.log('🔍 Testing webhook endpoint...');
  
  // Form data that mimics Twilio's format
  const formData = {
    From: 'whatsapp:+1234567890',
    Body: 'Hello, this is a test message!',
    ProfileName: 'Test User',
    MessageSid: 'SM' + Math.random().toString(36).substring(2, 15)
  };
  
  try {
    // Test the full webhook path
    console.log('Testing /api/v1/lead/webhook/whatsapp/incoming endpoint...');
    const response1 = await axios.post(
      'http://localhost:8000/api/v1/lead/webhook/whatsapp/incoming', 
      querystring.stringify(formData),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    console.log(`Response status: ${response1.status}`);
    console.log('Response:', response1.data);
    
    // Test the original webhook path
    console.log('\nTesting /api/v1/lead/webhook endpoint...');
    const response2 = await axios.post(
      'http://localhost:8000/api/v1/lead/webhook', 
      querystring.stringify(formData),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    console.log(`Response status: ${response2.status}`);
    console.log('Response:', response2.data);
    
    console.log('\n✅ Webhook test completed!');
  } catch (error) {
    console.error('❌ Error testing webhook:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testWebhook();
