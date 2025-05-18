/**
 * This script generates the webhook URL for Twilio based on your ngrok URL
 * Run with: node generate-webhook-url.js <YOUR_NGROK_URL>
 * 
 * Example: node generate-webhook-url.js https://1234-56-78-90-123.ngrok-free.app
 */

// Get the ngrok URL from command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('❌ Error: Please provide your ngrok URL as an argument');
  console.error('Example: node generate-webhook-url.js https://1234-56-78-90-123.ngrok-free.app');
  process.exit(1);
}

const ngrokUrl = args[0].trim();
console.log('\n🔗 Twilio Webhook Configuration Generator 🔗\n');
console.log('Base ngrok URL:', ngrokUrl);

// Ensure URL format is correct
if (!ngrokUrl.startsWith('http')) {
  console.error('❌ Error: URL must start with http:// or https://');
  process.exit(1);
}

// Remove trailing slash if present
const baseUrl = ngrokUrl.endsWith('/') ? ngrokUrl.slice(0, -1) : ngrokUrl;

// Generate webhook URLs
const webhookUrl = `${baseUrl}/api/v1/lead/webhook/whatsapp/incoming`;
const fallbackUrl = `${baseUrl}/api/v1/lead/webhook`;

console.log('\n✅ Configure your Twilio WhatsApp Sandbox with these URLs:');
console.log('----------------------------------------------------------');
console.log('Primary Webhook URL:');
console.log(webhookUrl);
console.log('\nAlternative Webhook URL (if the primary one doesn\'t work):');
console.log(fallbackUrl);
console.log('\n----------------------------------------------------------');
console.log('Make sure to set the HTTP method to POST in the Twilio console.');
console.log('The webhook now supports both form-urlencoded data format that Twilio uses.');
console.log('\nHappy messaging! 📱💬\n');
