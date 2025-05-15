import { Activity } from '../models/Activity.models.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const getActivities = asyncHandler(async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Prepare query filters
    let query = {};
    
    // If user is not admin, only show their activities
    if (req.user.role !== 'admin') {
      query.user = req.user._id;
    }
    
    // Get total count for pagination
    const totalCount = await Activity.countDocuments(query);
    
    // Fetch activities with pagination
    const activities = await Activity.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email _id')
      .populate('lead', 'name phone _id status')
      .lean();
    
    // Enrich the activities with additional computed fields
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
      
      return {
        ...activity,
        timeAgo,
        activityLabel,
        statusLabel,
        formattedDuration,
        formattedDate: new Date(activity.createdAt).toISOString().replace('T', ' ').substring(0, 16)
      };
    });

    return res.status(200).json(new ApiResponse(200, {
      activities: enrichedActivities,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalActivities: totalCount,
        hasMore: skip + activities.length < totalCount
      }
    }, "Activities fetched successfully"));
  } catch (error) {
    console.error("Error fetching activities:", error);
    return res.status(500).json(new ApiResponse(500, null, "Error fetching activities"));
  }
});

export { getActivities };
