# Twilio WhatsApp Webhook Guide

This guide will help you set up, test, and troubleshoot the Twilio WhatsApp webhook integration with your CRM.

## Setup Instructions

1. **Start your server**:
   ```bash
   cd server
   npm run dev
   ```

2. **Start ngrok** (install if not already done):
   ```bash
   ngrok http 8000
   ```

3. **Generate the webhook URL**:
   ```bash
   node generate-webhook-url.js <YOUR_NGROK_URL>
   ```
   This will generate the correct webhook URL to use in the Twilio console.

4. **Configure Twilio**:
   - Log in to your Twilio console
   - Navigate to Messaging > Settings > WhatsApp Sandbox
   - Set the "WHEN A MESSAGE COMES IN" field to your webhook URL
   - Make sure the HTTP method is set to POST

## Testing

### Local Testing

You can test your webhook locally without using Twilio:

```bash
node test-webhook.cjs
```

This will send test messages to both webhook endpoints and display the responses.

### Real Twilio Testing

1. Send a WhatsApp message to your Twilio WhatsApp number
2. Check your server logs for incoming webhook logs
3. Look for a response back on your WhatsApp

## Troubleshooting

### 502 Bad Gateway Error

If you see a 502 Bad Gateway error in your ngrok logs:

1. **Check server logs**: Look for any error messages in your server console
2. **Verify middleware**: Ensure the express.urlencoded middleware is set up correctly
3. **Test the simplified webhook**: Temporarily switch to the simplified webhook handler to isolate the issue
4. **Check Twilio format**: Verify the request format matches what your server expects

### No Response from Webhook

If Twilio is sending requests but your server isn't responding:

1. **Check route path**: Ensure the route path matches exactly what Twilio is calling
2. **Review logs**: Look for any request logs showing that the request is reaching your server
3. **Verify port**: Make sure ngrok is forwarding to the correct port (8000)

### Missing Data in Lead Records

If leads are being created but with missing data:

1. **Log request body**: Add detailed logging of the request body
2. **Check field mapping**: Ensure field names match between Twilio request and your model
3. **Verify database connection**: Check that MongoDB is connected properly

## Webhook Response Format

The webhook must respond with valid TwiML for Twilio to accept it:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Your message here</Message>
</Response>
```

## Common Issues

1. **Multiple responses**: Ensure you're not trying to send multiple responses in your handler
2. **Async issues**: Make sure all async operations are properly awaited
3. **Error handling**: Always have catch blocks for every async operation
4. **Content-Type**: Ensure response Content-Type is set to 'text/xml' for TwiML responses

## Advanced Testing

For advanced testing with simulated Twilio payloads:

```bash
curl -X POST http://localhost:8000/api/v1/lead/webhook/whatsapp/incoming \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+1234567890&Body=Hello+World&ProfileName=Test+User&MessageSid=SM12345678"
```

This will simulate a Twilio request directly to your server.
