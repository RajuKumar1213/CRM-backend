// Debug route to manually check activities
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Activity } from '../models/Activity.models.js';

// Configure environment variables
dotenv.config();

const app = express();
const PORT = 5001;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Get activities endpoint
app.get('/activities', async (req, res) => {
  try {
    // Check if there are any activities
    const count = await Activity.countDocuments();
    console.log(`Total activities in database: ${count}`);
    
    // Get activities
    const activities = await Activity.find()
      .sort('-createdAt')
      .limit(10)
      .populate('user', 'name email')
      .populate('lead', 'name phone');
      
    // If no activities, create a test one
    if (count === 0) {
      console.log('No activities found, please create a test activity');
    }
    
    res.json({
      success: true,
      count,
      activities
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Debug server running on port ${PORT}`);
  console.log('Open http://localhost:5001/activities to check activities');
});
