import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Activity } from '../models/Activity.models.js';
import { User } from '../models/User.models.js';
import { Lead } from '../models/Lead.models.js';

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const seedActivities = async () => {
  try {
    // Get a user and lead to associate with activities
    const user = await User.findOne();
    const lead = await Lead.findOne();
    
    if (!user || !lead) {
      console.error('No users or leads found to associate with activities');
      process.exit(1);
    }
    
    console.log(`Using user: ${user.name} (${user._id}) and lead: ${lead.name} (${lead._id})`);
    
    // Sample activity types
    const activityTypes = ['call', 'whatsapp', 'email', 'meeting', 'note'];
    const statuses = ['attempted', 'connected', 'not-answered', 'completed'];
    
    // Create 5 sample activities
    const activities = [];
    
    for (let i = 0; i < 5; i++) {
      const type = activityTypes[Math.floor(Math.random() * activityTypes.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      const activity = {
        lead: lead._id,
        user: user._id,
        type,
        status,
        notes: `This is a test ${type} activity with ${status} status`,
        duration: type === 'call' ? Math.floor(Math.random() * 300) : null // Random duration for calls
      };
      
      activities.push(activity);
    }
    
    // Clear existing activities and add new ones
    await Activity.deleteMany({});
    const created = await Activity.insertMany(activities);
    
    console.log(`Created ${created.length} test activities`);
    console.log('Activity sample:', created[0]);
    
  } catch (error) {
    console.error('Error seeding activities:', error);
  } finally {
    mongoose.disconnect();
    console.log('Done. MongoDB disconnected');
  }
};

seedActivities();
