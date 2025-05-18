/**
 * This is a simplified webhook handler for testing the Twilio webhook endpoint
 */

export const handleWhatsAppWebhook = async (req, res) => {
  console.log("💬 Twilio WhatsApp webhook received - SIMPLIFIED TEST HANDLER");
  
  // Log the request format completely
  console.log("Request body:", JSON.stringify(req.body, null, 2));
  console.log("Request headers:", JSON.stringify(req.headers, null, 2));
  console.log("Request query:", JSON.stringify(req.query, null, 2));
  
  // Always respond with a valid status - don't risk throwing errors
  try {
    // Extract basic info from request (any format)
    const body = req.body || {};
    
    // Support both direct properties and nested formats
    const messageBody = body.Body || body.message || body.text || 'No message content';
    const from = body.From || body.from || body.sender || 'Unknown sender';
    const profileName = body.ProfileName || body.profile_name || body.name || 'Unknown name';
    
    console.log(`From: ${from} | Name: ${profileName} | Message: ${messageBody}`);
    
    // Determine content type based on request headers
    const contentType = req.headers['content-type'] || 'text/xml';
    
    if (contentType.includes('json')) {
      // Respond with JSON
      return res.status(200).json({
        status: 'success',
        message: 'Webhook received successfully'
      });
    } else if (contentType.includes('form')) {
      // Respond with plain text for form submissions
      return res.status(200).send('Message received. Thank you for contacting us!');
    } else {
      // Default to TwiML
      const twimlResponse = '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Your message has been received. Thank you for contacting us!</Message></Response>';
      res.writeHead(200, { 'Content-Type': 'text/xml' });
      return res.end(twimlResponse);
    }
  } catch (error) {
    // Log the error but don't let it affect the response
    console.error('Error in simplified webhook handler:', error);
    
    // Still return 200 to prevent Twilio retries - most basic plain text response
    return res.status(200).send('Message received');
  }
};
