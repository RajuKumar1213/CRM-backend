// This script creates test activities to help with debugging
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Activity } from '../models/Activity.models.js';
import { User } from '../models/User.models.js';
import { Lead } from '../models/Lead.models.js';

// Configure environment variables
dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Create a simple test activity
const createTestActivity = async () => {
  try {
    // Get the first user and lead from the database
    const user = await User.findOne();
    const lead = await Lead.findOne();
    
    if (!user || !lead) {
      console.error('No users or leads found in the database');
      return;
    }
    
    console.log(`Found user: ${user.name || user._id}`);
    console.log(`Found lead: ${lead.name || lead._id}`);
    
    // Create a test activity
    const activity = await Activity.create({
      user: user._id,
      lead: lead._id,
      type: 'note',
      status: 'completed',
      notes: 'This is a test activity created for debugging purposes',
      createdAt: new Date()
    });
    
    console.log('Successfully created test activity:', activity._id);
    
  } catch (error) {
    console.error('Error creating test activity:', error);
  } finally {
    mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
};

// Run the script
connectDB()
  .then(() => createTestActivity())
  .catch(err => console.error('Error in script execution:', err));
