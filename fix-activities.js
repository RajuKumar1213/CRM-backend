// Script to fix activities by generating test data and implementing a better solution
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Activity } from './src/models/Activity.models.js';
import { User } from './src/models/User.models.js';
import { Lead } from './src/models/Lead.models.js';

// Configure environment variables
dotenv.config();

console.log("Starting activity fix script...");

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Create test activities
const createTestActivities = async () => {
  try {
    // Get users and leads
    const users = await User.find().limit(2);
    const leads = await Lead.find().limit(3);
    
    if (users.length === 0 || leads.length === 0) {
      console.error('No users or leads found in the database');
      return;
    }
    
    console.log(`Found ${users.length} users and ${leads.length} leads`);
    
    // Create 5 test activities with different types
    const activityTypes = ['call', 'whatsapp', 'email', 'meeting', 'note'];
    const statuses = ['connected', 'not-answered', 'attempted', 'completed'];
    
    const activities = [];
    
    for (let i = 0; i < 5; i++) {
      const user = users[i % users.length];
      const lead = leads[i % leads.length];
      const type = activityTypes[i % activityTypes.length];
      const status = statuses[i % statuses.length];
      
      const activityData = {
        user: user._id,
        lead: lead._id,
        type,
        status,
        notes: `This is a test ${type} activity created to fix the display issue - ${i + 1}`,
        duration: type === 'call' ? (i + 1) * 30 : undefined, // Only add duration for calls
        createdAt: new Date(Date.now() - (i * 3600000)) // Spread out over time
      };
      
      const activity = await Activity.create(activityData);
      activities.push(activity);
      console.log(`Created activity: ${activity._id} (${type})`);
    }
    
    console.log('Successfully created test activities');
    
    // Test fetching with both methods
    await testFetchMethods();
    
    return activities;
  } catch (error) {
    console.error('Error creating test activities:', error);
    throw error;
  }
};

// Test both fetch methods to diagnose the issue
const testFetchMethods = async () => {
  try {
    console.log("\n===== TESTING FETCH METHODS =====");
    
    // Method 1: Aggregation Pipeline
    console.log("\n> Testing aggregation pipeline:");
    const baseStages = [
      { $sort: { createdAt: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userInfo"
        }
      },
      {
        $unwind: {
          path: "$userInfo",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: "leads",
          localField: "lead",
          foreignField: "_id",
          as: "leadInfo"
        }
      },
      {
        $unwind: {
          path: "$leadInfo",
          preserveNullAndEmptyArrays: true
        }
      }
    ];
    
    try {
      const aggregationResults = await Activity.aggregate(baseStages);
      console.log(`Aggregation pipeline returned ${aggregationResults.length} results`);
      if (aggregationResults.length > 0) {
        console.log("First result ID:", aggregationResults[0]._id);
      }
    } catch (err) {
      console.error("Aggregation pipeline error:", err);
    }
    
    // Method 2: Simple Find with Populate
    console.log("\n> Testing simple find with populate:");
    const findResults = await Activity.find()
      .sort('-createdAt')
      .limit(10)
      .populate('user', 'name email _id')
      .populate('lead', 'name phone _id status')
      .lean();
      
    console.log(`Simple find returned ${findResults.length} results`);
    if (findResults.length > 0) {
      console.log("First result ID:", findResults[0]._id);
      console.log("Sample result structure:", JSON.stringify({
        _id: findResults[0]._id,
        type: findResults[0].type,
        status: findResults[0].status,
        user: findResults[0].user ? {
          _id: findResults[0].user._id,
          name: findResults[0].user.name
        } : 'No user data',
        lead: findResults[0].lead ? {
          _id: findResults[0].lead._id,
          name: findResults[0].lead.name
        } : 'No lead data'
      }, null, 2));
    }
    
    console.log("\n===== TEST COMPLETED =====");
    console.log("\nRECOMMENDATION: Replace the getActivities function with the simpler version from simplified-activities.js");
    
  } catch (error) {
    console.error('Error testing fetch methods:', error);
  }
};

// Main execution
const run = async () => {
  try {
    // Check if there are already activities
    const count = await Activity.countDocuments();
    console.log(`Found ${count} existing activities`);
    
    if (count === 0) {
      console.log("No activities found, creating test activities...");
      await createTestActivities();
    } else {
      console.log("Testing fetch methods with existing activities...");
      await testFetchMethods();
    }
    
    console.log("\nScript completed successfully!");
  } catch (error) {
    console.error('Error in script execution:', error);
  } finally {
    // Close the MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
};

// Run the script
run();
