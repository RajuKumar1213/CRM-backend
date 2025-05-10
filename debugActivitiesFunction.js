// get activities based on user role - simplified version for debugging
const getActivities = asyncHandler(async (req, res, next) => {
  try {
    // Check total activities in the database
    const totalCount = await Activity.countDocuments({});
    console.log(`Total activities in database: ${totalCount}`);
    
    // Basic query
    let query = Activity.find()
      .sort('-createdAt')
      .limit(10)
      .populate('user', 'name email')
      .populate('lead', 'name phone status');
    
    // Filter by user role
    if (req.user.role !== 'admin') {
      query = query.where('user').equals(req.user._id);
    }
    
    // Execute query
    const activities = await query;
    
    console.log(`Found ${activities.length} activities for user ${req.user.name} (${req.user._id})`);
    
    // Transform the activities to include additional computed fields
    const transformedActivities = activities.map(activity => {
      // Convert to plain object
      const act = activity.toObject();
      
      // Add computed fields
      act.activityLabel = getActivityLabel(act.type);
      act.statusLabel = getStatusLabel(act.status);
      act.formattedDuration = formatActivityDuration(act.type, act.duration);
      
      return act;
    });
    
    return res
      .status(200)
      .json(new ApiResponse(200, { 
        count: transformedActivities.length,
        activities: transformedActivities
      }, transformedActivities.length > 0 ? "Activities fetched successfully" : "No activities found"));
  
  } catch (error) {
    console.error('Error fetching activities:', error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Error fetching activities: " + error.message));
  }
});

// Helper functions for activity display
function getActivityLabel(type) {
  switch (type) {
    case 'call': return "Made a call";
    case 'whatsapp': return "Sent WhatsApp message";
    case 'email': return "Sent email";
    case 'meeting': return "Had a meeting";
    case 'note': return "Added a note";
    default: return "Interacted with lead";
  }
}

function getStatusLabel(status) {
  switch (status) {
    case 'connected': return "Connected";
    case 'not-answered': return "No answer";
    case 'attempted': return "Attempted";
    case 'completed': return "Completed";
    default: return status;
  }
}

function formatActivityDuration(type, duration) {
  if (type !== 'call' || !duration) return null;
  
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  
  return `${minutes}m ${seconds}s`;
}
