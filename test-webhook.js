// A simple script to test the Twilio webhook endpoint locally
// Run with: node test-webhook.js

import fetch from 'node-fetch';

// Simulate a Twilio webhook request
async function testWebhook() {
  console.log('🔍 Testing webhook endpoint...');
  
  // Form data that mimics Twilio's format
  const formData = new URLSearchParams();
  formData.append('From', 'whatsapp:+1234567890');
  formData.append('Body', 'Hello, this is a test message!');
  formData.append('ProfileName', 'Test User');
  formData.append('MessageSid', 'SM' + Math.random().toString(36).substring(2, 15));
  
  try {
    // Test the full webhook path
    console.log('Testing /api/v1/lead/webhook/whatsapp/incoming endpoint...');
    const response1 = await fetch('http://localhost:8000/api/v1/lead/webhook/whatsapp/incoming', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData
    });
    
    const result1 = await response1.text();
    console.log(`Response status: ${response1.status}`);
    console.log('Response:', result1);
    
    // Test the original webhook path
    console.log('\nTesting /api/v1/lead/webhook endpoint...');
    const response2 = await fetch('http://localhost:8000/api/v1/lead/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData
    });
    
    const result2 = await response2.text();
    console.log(`Response status: ${response2.status}`);
    console.log('Response:', result2);
    
    console.log('\n✅ Webhook test completed!');
  } catch (error) {
    console.error('❌ Error testing webhook:', error);
  }
}

// Run the test
testWebhook();
