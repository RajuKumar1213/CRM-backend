// Simple script to create a test activity
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Activity } from './src/models/Activity.models.js';
import { User } from './src/models/User.models.js';
import { Lead } from './src/models/Lead.models.js';

// Configure environment variables
dotenv.config();

console.log("Starting test activity creation script...");

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Simple function to create a test activity using existing user and lead
const createTestActivity = async () => {
  try {
    // Find the first user and lead in the database
    const user = await User.findOne();
    const lead = await Lead.findOne();
    
    if (!user || !lead) {
      console.error('No users or leads found in the database');
      console.log('Please make sure you have users and leads in your database');
      return;
    }
    
    console.log(`Found user: ${user.name} (${user._id})`);
    console.log(`Found lead: ${lead.name} (${lead._id})`);
    
    // Create a test activity
    const activity = await Activity.create({
      user: user._id,
      lead: lead._id,
      type: 'note',
      status: 'completed',
      notes: 'This is a test activity created for debugging purposes',
      createdAt: new Date()
    });
    
    console.log(`Successfully created test activity: ${activity._id}`);
    
    // Verify the activity can be retrieved
    const retrieved = await Activity.findById(activity._id)
      .populate('user', 'name email')
      .populate('lead', 'name phone');
      
    console.log("Retrieved activity details:");
    console.log(`- Type: ${retrieved.type}`);
    console.log(`- Status: ${retrieved.status}`);
    console.log(`- Notes: ${retrieved.notes}`);
    console.log(`- User: ${retrieved.user.name}`);
    console.log(`- Lead: ${retrieved.lead.name}`);
    
    return activity;
  } catch (error) {
    console.error('Error creating test activity:', error);
  }
};

// Main execution
(async () => {
  try {
    await createTestActivity();
    console.log("\nScript completed successfully!");
    console.log("\nTo fix the getActivities function:");
    console.log("1. Open src/controllers/lead.controller.js");
    console.log("2. Replace the getActivities function with the code from fixed-getActivities.js");
    console.log("3. Restart your server");
  } catch (error) {
    console.error('Error in script execution:', error);
  } finally {
    // Close the MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
})();
