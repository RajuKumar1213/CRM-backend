// Test Lead model status validation
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Lead } from './src/models/Lead.models.js';

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB for test'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const testLeadStatusValidation = async () => {
  try {
    // Attempt to create a lead with old status format
    try {
      const lead = await Lead.create({
        name: 'Test Status Validation',
        phone: '+919876543210',
        source: 'whatsapp',
        status: 'closed-won' // Should fail validation
      });
      
      console.log('❌ Test failed: Created lead with invalid status:', lead.status);
    } catch (err) {
      console.log('✅ Test passed: Lead with invalid status was rejected');
      console.log('Error message:', err.message);
    }
    
    // Try with a valid status
    try {
      const lead = await Lead.create({
        name: 'Test Status Validation',
        phone: '+919876543210',
        source: 'whatsapp',
        status: 'won' // Valid status
      });
      
      console.log('✅ Test passed: Created lead with valid status:', lead.status);
      
      // Clean up
      await Lead.findByIdAndDelete(lead._id);
    } catch (err) {
      console.log('❌ Test failed: Could not create lead with valid status');
      console.log('Error message:', err.message);
    }
    
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

testLeadStatusValidation();
