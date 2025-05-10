// This script provides a simpler implementation for activities fetching
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

// Create multiple test activities with different types
const createTestActivities = async () => {
  try {
    // Get users and leads from the database
    const users = await User.find().limit(2);
    const leads = await Lead.find().limit(3);
    
    if (users.length === 0 || leads.length === 0) {
      console.error('No users or leads found in the database');
      return;
    }
    
    console.log(`Found ${users.length} users and ${leads.length} leads`);
    
    // Activity types to create
    const activityTypes = ['call', 'whatsapp', 'email', 'meeting', 'note'];
    const statuses = ['connected', 'not-answered', 'attempted', 'completed'];
    
    // Create a variety of activities
    const activities = [];
    for (let i = 0; i < 10; i++) {
      const user = users[i % users.length];
      const lead = leads[i % leads.length];
      const type = activityTypes[i % activityTypes.length];
      const status = statuses[i % statuses.length];
      
      const activityData = {
        user: user._id,
        lead: lead._id,
        type,
        status,
        notes: `This is a test ${type} activity for debugging purposes - ${i}`,
        duration: type === 'call' ? 60 + (i * 30) : undefined, // Only add duration for calls
        createdAt: new Date(Date.now() - (i * 3600000)) // Space them out by hours
      };
      
      const activity = await Activity.create(activityData);
      activities.push(activity);
      console.log(`Created ${type} activity: ${activity._id}`);
    }
    
    console.log('Successfully created test activities');
    return activities;
  } catch (error) {
    console.error('Error creating test activities:', error);
  }
};

// Test fetching activities with a simple query
const testFetchActivities = async () => {
  try {
    // Check total count
    const count = await Activity.countDocuments();
    console.log(`Total activities in database: ${count}`);
    
    if (count === 0) {
      console.log('No activities found, creating test activities...');
      await createTestActivities();
    }
    
    // Simple query approach
    const activities = await Activity.find()
      .sort('-createdAt')
      .limit(10)
      .populate('user', 'name email _id')
      .populate('lead', 'name phone _id status')
      .lean();
    
    console.log(`Fetched ${activities.length} activities using simple query`);
    
    // Format and enrich the activities
    const enrichedActivities = activities.map(activity => {
      // Calculate time ago
      const now = new Date();
      const created = new Date(activity.createdAt);
      const diffMs = now - created;
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);
      
      let timeAgo = "just now";
      if (diffDays > 0) {
        timeAgo = diffDays + " day(s) ago";
      } else if (diffHours > 0) {
        timeAgo = diffHours + " hour(s) ago";
      } else if (diffMins > 0) {
        timeAgo = diffMins + " minute(s) ago";
      }
      
      // Additional fields
      return {
        ...activity,
        timeAgo,
        activityLabel: getActivityLabel(activity.type),
        statusLabel: getStatusLabel(activity.status),
        formattedDuration: formatDuration(activity.duration)
      };
    });
    
    console.log('First enriched activity:', JSON.stringify(enrichedActivities[0], null, 2));
    return enrichedActivities;
  } catch (error) {
    console.error('Error fetching and processing activities:', error);
  }
};

// Helper functions
const getActivityLabel = (type) => {
  switch (type) {
    case 'call': return 'Made a call';
    case 'whatsapp': return 'Sent WhatsApp message';
    case 'email': return 'Sent email';
    case 'meeting': return 'Had a meeting';
    case 'note': return 'Added a note';
    default: return 'Interacted with lead';
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'connected': return 'Connected';
    case 'not-answered': return 'No answer';
    case 'attempted': return 'Attempted';
    case 'completed': return 'Completed';
    default: return status;
  }
};

const formatDuration = (seconds) => {
  if (!seconds) return null;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

// Run the script
connectDB()
  .then(async () => {
    console.log('Testing activity fetching...');
    await testFetchActivities();
    console.log('Done!');
  })
  .catch(err => console.error('Error in script execution:', err))
  .finally(() => {
    mongoose.disconnect();
    console.log('MongoDB disconnected');
  });
