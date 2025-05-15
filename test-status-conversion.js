// Test WhatsApp notification with old status format
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Lead } from './src/models/Lead.models.js';
import { User } from './src/models/User.models.js';
import { sendWhatsAppMessage } from './src/utils/watsappService.js';

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB for test'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const testStatusConversion = async () => {
  try {
    // Find any user or create one if none exists
    let user = await User.findOne({});
    
    if (!user) {
      console.log('No user found, creating a test user');      user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        phone: '+919876543210',
        role: 'employee'
      });
      console.log('Created test user:', user._id);
    }
    
    // Create a test lead with old status format
    const lead = await Lead.create({
      name: 'Test Status Conversion',
      phone: '+1234567890',
      source: 'whatsapp',
      status: 'closed-won', // Using old status format
      assignedTo: user._id
    });
    
    console.log('Created test lead with old status format:', lead);
    
    // Try to send a WhatsApp message to test conversion
    try {
      await sendWhatsAppMessage(
        lead._id,
        user._id,
        null,
        process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886',
        `Test message to verify status conversion from closed-won to won`
      );
      
      // Check if status was converted
      const updatedLead = await Lead.findById(lead._id);
      console.log('Updated lead status:', updatedLead.status);
      
      if (updatedLead.status === 'won') {
        console.log('✅ Status successfully converted from closed-won to won');
      } else {
        console.log('❌ Status was not converted');
      }
    } catch (err) {
      console.error('Error sending WhatsApp message:', err.message);
    }
    
    // Clean up - delete the test lead
    await Lead.findByIdAndDelete(lead._id);
    console.log('Test lead deleted');
    
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

testStatusConversion();
