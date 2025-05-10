// Script to create essential data for testing
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './src/models/User.models.js';
import { Lead } from './src/models/Lead.models.js';
import { Activity } from './src/models/Activity.models.js';
import bcrypt from 'bcrypt';

// Configure environment variables
dotenv.config();

console.log("Starting data generation script...");

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Create test users if none exist
const createTestUsers = async () => {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log(`Found ${userCount} existing users, skipping user creation`);
      return await User.find().limit(2);
    }
    
    console.log("Creating test users...");
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const users = await Promise.all([
      User.create({
        name: 'Admin User',
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'admin'
      }),
      User.create({
        name: 'Employee User',
        email: 'employee@example.com',
        password: hashedPassword,
        role: 'employee'
      })
    ]);
    
    console.log(`Created ${users.length} test users`);
    return users;
  } catch (error) {
    console.error('Error creating test users:', error);
    throw error;
  }
};

// Create test leads if none exist
const createTestLeads = async (userId) => {
  try {
    const leadCount = await Lead.countDocuments();
    if (leadCount > 0) {
      console.log(`Found ${leadCount} existing leads, skipping lead creation`);
      return await Lead.find().limit(3);
    }
    
    console.log("Creating test leads...");
    const leads = [];
    
    for (let i = 1; i <= 3; i++) {
      const lead = await Lead.create({
        name: `Test Lead ${i}`,
        email: `lead${i}@example.com`,
        phone: `+1234567890${i}`,
        source: i === 1 ? 'website' : i === 2 ? 'referral' : 'whatsapp',
        status: i === 1 ? 'new' : i === 2 ? 'contacted' : 'qualified',
        assignedTo: userId
      });
      leads.push(lead);
    }
    
    console.log(`Created ${leads.length} test leads`);
    return leads;
  } catch (error) {
    console.error('Error creating test leads:', error);
    throw error;
  }
};

// Create test activities
const createTestActivities = async (users, leads) => {
  try {
    const activityCount = await Activity.countDocuments();
    if (activityCount > 0) {
      console.log(`Found ${activityCount} existing activities, skipping activity creation`);
      return;
    }
    
    console.log("Creating test activities...");
    const activityTypes = ['call', 'whatsapp', 'email', 'meeting', 'note'];
    const statuses = ['connected', 'not-answered', 'attempted', 'completed'];
    
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
        notes: `This is a test ${type} activity for lead ${lead.name} - ${i + 1}`,
        duration: type === 'call' ? (i + 1) * 30 : undefined, // Only add duration for calls
        createdAt: new Date(Date.now() - (i * 3600000)) // Spread out over time
      };
      
      const activity = await Activity.create(activityData);
      activities.push(activity);
      console.log(`Created activity: ${activity._id} (${type})`);
    }
    
    console.log(`Created ${activities.length} test activities`);
    return activities;
  } catch (error) {
    console.error('Error creating test activities:', error);
    throw error;
  }
};

// Test fetching methods
const testFetchMethods = async (userId) => {
  try {
    console.log("\n===== TESTING ACTIVITY FETCH METHODS =====");
    
    // Method 1: Simple Find with Populate
    console.log("\n> Testing simple find with populate (recommended method):");
    
    // Prepare query filters based on user role
    const query = {}; // For admin or if no user provided
    if (userId) {
      query.user = userId;
      console.log(`Filtering for user ID: ${userId}`);
    }
    
    const findResults = await Activity.find(query)
      .sort('-createdAt')
      .limit(10)
      .populate('user', 'name email _id')
      .populate('lead', 'name phone _id status')
      .lean();
      
    console.log(`Simple find returned ${findResults.length} results`);
    
    if (findResults.length > 0) {
      console.log("Sample activity:", JSON.stringify({
        _id: findResults[0]._id,
        type: findResults[0].type,
        status: findResults[0].status,
        notes: findResults[0].notes?.substring(0, 30) + "...",
        user: findResults[0].user ? {
          _id: findResults[0].user._id,
          name: findResults[0].user.name
        } : 'No user data',
        lead: findResults[0].lead ? {
          _id: findResults[0].lead._id,
          name: findResults[0].lead.name
        } : 'No lead data'
      }, null, 2));
      
      // Create the enriched activity structure for frontend
      const enrichedActivity = {
        ...findResults[0],
        timeAgo: "just now", // This would be calculated in real code
        activityLabel: getActivityLabel(findResults[0].type),
        statusLabel: getStatusLabel(findResults[0].status),
        formattedDuration: formatDuration(findResults[0].duration),
        userInfo: findResults[0].user,
        leadInfo: findResults[0].lead,
        formattedDate: new Date(findResults[0].createdAt).toISOString().replace('T', ' ').substring(0, 16)
      };
      
      console.log("\nEnriched activity sample (what frontend expects):", JSON.stringify({
        _id: enrichedActivity._id,
        type: enrichedActivity.type,
        activityLabel: enrichedActivity.activityLabel,
        statusLabel: enrichedActivity.statusLabel,
        formattedDuration: enrichedActivity.formattedDuration,
        userInfo: {
          name: enrichedActivity.userInfo?.name,
          _id: enrichedActivity.userInfo?._id
        },
        leadInfo: {
          name: enrichedActivity.leadInfo?.name,
          _id: enrichedActivity.leadInfo?._id
        },
        timeAgo: enrichedActivity.timeAgo,
        formattedDate: enrichedActivity.formattedDate
      }, null, 2));
    }
    
    console.log("\n===== TEST COMPLETED =====");
    console.log("\nRECOMMENDATION: Use the simplified approach instead of MongoDB aggregation pipeline");
    
  } catch (error) {
    console.error('Error testing fetch methods:', error);
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

// Main execution
const run = async () => {
  try {
    // Create test users, leads, and activities
    const users = await createTestUsers();
    const leads = await createTestLeads(users[0]._id);
    await createTestActivities(users, leads);
    
    // Test activity fetching for both admin and employee
    await testFetchMethods(); // No filter (admin view)
    await testFetchMethods(users[1]._id); // Employee view
    
    console.log("\nThe fix-activities script has successfully created test data.");
    console.log("Here's how to fix the getActivities function in lead.controller.js:");
    console.log("=====================================================");
    console.log("1. Replace the entire function with this simpler version:");
    console.log(`
const getActivities = asyncHandler(async (req, res, next) => {
  try {
    // First check if there are any activities at all in the database
    const totalCount = await Activity.countDocuments({});
    console.log(\`Total activities in database: \${totalCount}\`);
    
    // Prepare query filters
    let query = {};
    
    // If user is not admin, only show their activities
    if (req.user.role !== 'admin') {
      query.user = req.user._id;
    }
    
    // Get limit from query or use default
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    
    // Use a simpler approach with find() instead of aggregate
    const activities = await Activity.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('user', 'name email _id')
      .populate('lead', 'name phone _id status')
      .lean();
      
    console.log(\`Found \${activities.length} activities\`);
    
    // Enrich the activities with all the fields that frontend expects
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
      
      // Activity label
      let activityLabel = "Interacted with lead";
      switch (activity.type) {
        case "call": activityLabel = "Made a call"; break;
        case "whatsapp": activityLabel = "Sent WhatsApp message"; break;
        case "email": activityLabel = "Sent email"; break;
        case "meeting": activityLabel = "Had a meeting"; break;
        case "note": activityLabel = "Added a note"; break;
      }
      
      // Status label
      let statusLabel = activity.status;
      switch (activity.status) {
        case "connected": statusLabel = "Connected"; break;
        case "not-answered": statusLabel = "No answer"; break;
        case "attempted": statusLabel = "Attempted"; break;
        case "completed": statusLabel = "Completed"; break;
      }
      
      // Format duration
      let formattedDuration = null;
      if (activity.duration && activity.duration > 0) {
        const minutes = Math.floor(activity.duration / 60);
        const seconds = activity.duration % 60;
        formattedDuration = \`\${minutes}m \${seconds}s\`;
      }
      
      // Return enriched activity
      return {
        ...activity,
        timeAgo,
        activityLabel,
        statusLabel,
        formattedDuration,
        userInfo: activity.user,
        leadInfo: activity.lead,
        formattedDate: new Date(activity.createdAt).toISOString().replace('T', ' ').substring(0, 16)
      };
    });

    // Return the enriched activities
    return res.status(200).json(new ApiResponse(200, { 
      count: enrichedActivities.length,
      activities: enrichedActivities,
      user: {
        id: req.user._id,
        role: req.user.role
      }
    }, enrichedActivities.length > 0 ? "Activities fetched successfully" : "No activities found"));
  } catch (error) {
    console.error("Error fetching activities:", error);
    return res.status(500).json(new ApiResponse(500, null, "Error fetching activities"));
  }
});`);
    
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
