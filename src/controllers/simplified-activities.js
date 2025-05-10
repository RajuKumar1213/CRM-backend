// This file contains an alternative implementation for the getActivities function
// that uses a simpler approach to query the database
import { Activity } from '../models/Activity.models.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const getActivities = asyncHandler(async (req, res, next) => {
  try {
    // First check if there are any activities at all in the database
    const totalCount = await Activity.countDocuments({});
    console.log(`Total activities in database: ${totalCount}`);
    
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
      
    console.log(`Found ${activities.length} activities`);
    
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
        formattedDuration = `${minutes}m ${seconds}s`;
      }
      
      // Transform populated fields to match the expected frontend structure
      const userInfo = activity.user ? {
        _id: activity.user._id,
        name: activity.user.name,
        email: activity.user.email
      } : null;
      
      const leadInfo = activity.lead ? {
        _id: activity.lead._id,
        name: activity.lead.name,
        phone: activity.lead.phone,
        status: activity.lead.status
      } : null;
      
      // Return enriched activity
      return {
        ...activity,
        timeAgo,
        activityLabel,
        statusLabel,
        formattedDuration,
        userInfo,
        leadInfo,
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
});

export default getActivities;
