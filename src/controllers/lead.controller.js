import asyncHandler from '../utils/asyncHandler.js';

import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { assignLeadToNextEmployee } from '../utils/leadRotation.js';
import { scheduleFollowUp } from '../utils/followUpScheduler.js';
import { Lead } from '../models/Lead.models.js';
import { FollowUp } from '../models/FollowUp.models.js';
import { Activity } from '../models/Activity.models.js';
import { CompanySetting } from '../models/CompanySettings.models.js';
import mongoose from 'mongoose';
import twilio from 'twilio';
import dotenv from 'dotenv';

// Helper functions for formatting lead data
const formatDuration = (seconds) => {
  if (!seconds) return null;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${remainingSeconds}s`;
};

const getTimeUntil = (dateTime) => {
  const now = new Date();
  const targetDate = new Date(dateTime);
  const diffMs = targetDate - now;
  
  // If date is in the past
  if (diffMs < 0) {
    const absDiffMs = Math.abs(diffMs);
    const days = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));
    if (days > 0) return `${days} day(s) ago`;
    
    const hours = Math.floor((absDiffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (hours > 0) return `${hours} hour(s) ago`;
    
    const minutes = Math.floor((absDiffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${minutes} minute(s) ago`;
  }
  
  // If date is in the future
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days > 0) return `in ${days} day(s)`;
  
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (hours > 0) return `in ${hours} hour(s)`;
  
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `in ${minutes} minute(s)`;
};

dotenv.config();

// setup twilio
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const MessagingResponse = twilio.twiml.MessagingResponse;
const twiml = new MessagingResponse();

// @desc    Get all leads
// @route   GET /api/v1/leads
// @access  Private
const getLeads = asyncHandler(async (req, res, next) => {
  // let query;

  // // Copy req.query
  // const reqQuery = { ...req.query };

  // // Fields to exclude
  // const removeFields = ['select', 'sort', 'page', 'limit'];

  // // Loop over removeFields and delete them from reqQuery
  // removeFields.forEach((param) => delete reqQuery[param]);

  // // If user is not admin, only show leads assigned to them
  // if (req.user.role !== 'admin') {
  //   reqQuery.assignedTo = req.user._id;
  // }

  // // Create query string
  // let queryStr = JSON.stringify(reqQuery);

  // // Create operators ($gt, $gte, etc)
  // queryStr = queryStr.replace(
  //   /\b(gt|gte|lt|lte|in)\b/g,
  //   (match) => `$${match}`
  // );

  // // Finding resource
  // query = Lead.find(JSON.parse(queryStr)).populate('assignedTo', 'name email');

  // // Select Fields
  // if (req.query.select) {
  //   const fields = req.query.select.split(',').join(' ');
  //   query = query.select(fields);
  // }

  // // Sort
  // if (req.query.sort) {
  //   const sortBy = req.query.sort.split(',').join(' ');
  //   query = query.sort(sortBy);
  // } else {
  //   query = query.sort('-createdAt');
  // }

  // // Pagination
  // const page = parseInt(req.query.page, 10) || 1;
  // const limit = parseInt(req.query.limit, 10) || 25;
  // const startIndex = (page - 1) * limit;
  // const endIndex = page * limit;
  // const total = await Lead.countDocuments(JSON.parse(queryStr));

  // query = query.skip(startIndex).limit(limit);

  // // Executing query
  // const leads = await query;

  // // Pagination result
  // const pagination = {};

  // if (endIndex < total) {
  //   pagination.next = {
  //     page: page + 1,
  //     limit,
  //   };
  // }

  // if (startIndex > 0) {
  //   pagination.prev = {
  //     page: page - 1,
  //     limit,
  //   };
  // }

  // const leads = await Lead.aggregate([
  //   {
  //     $match: {},
  //   },
  //   {
  //     $lookup: {
  //       from: 'users',
  //       localField: 'assignedTo',
  //       foreignField: '_id',
  //       as: 'assignedTo',
  //     },
  //   },
  //   {
  //     $unwind: '$assignedTo',
  //   },
  // ]);

  const leads = await Lead.find({}).populate('assignedTo', 'name email _id');

  return res
    .status(200)
    .json(new ApiResponse(200, leads, 'Leads fetched successfully'));
});

// @desc    Get single lead
// @route   GET /api/v1/leads/:id
// @access  Privat
//

const getUserLeads = asyncHandler(async (req, res)=> {

  const leads = await Lead.find({assignedTo: req.user._id}).select("-messageSid")

  if(!leads){
    throw new ApiError(404, "Leads not found")
  }

  return res.status(200).json(new ApiResponse(200, leads , "Leads fetched successfully"))

})

const getLead = asyncHandler(async (req, res) => {
  const { leadId } = req.params;

  const lead = await Lead.findById(leadId)

  if (!lead) {
    throw new ApiError(404, 'Lead not found');
  }

  // Make sure user is lead owner or admin
  if (!lead.assignedTo._id.equals(req.user._id) && req.user.role !== 'admin') {
    throw new ApiError(401, 'User is not authorized to view this lead');
  }
  // Get follow-ups and activities for this lead with populated references
  const followUps = await FollowUp.find({ lead: leadId })
    .sort('-scheduled')
    .populate('assignedTo', 'name email')
    .lean();
    
  const activities = await Activity.find({ lead: leadId })
    .sort('-createdAt')
    .populate('user', 'name email')
    .populate({
      path: 'templateUsed',
      select: 'name content',
    })
    .lean();
    
  // Enrich activity data with better contextual information
  const enrichedActivities = activities.map(activity => {
    // Add human-readable activity descriptions based on type
    let actionText = "";
    let statusText = "";
    
    switch (activity.type) {
      case 'call':
        actionText = "Made a call";
        statusText = activity.status === 'connected' ? "Connected" : 
                     activity.status === 'not-answered' ? "No answer" : 
                     activity.status === 'attempted' ? "Attempted" : "Completed";
        break;
      case 'whatsapp':
        actionText = "Sent WhatsApp message";
        statusText = activity.status === 'completed' ? "Delivered" : activity.status;
        break;
      case 'email':
        actionText = "Sent email";
        statusText = activity.status === 'completed' ? "Sent" : activity.status;
        break;
      case 'meeting':
        actionText = "Had a meeting";
        statusText = activity.status === 'completed' ? "Completed" : activity.status;
        break;
      case 'note':
        actionText = "Added a note";
        statusText = "";
        break;
      default:
        actionText = "Interacted with lead";
        statusText = activity.status;
    }
    
    return {
      ...activity,
      actionText,
      statusText,
      durationFormatted: activity.duration ? formatDuration(activity.duration) : null,
    };
  });
  
  // Enrich followup data with status descriptions
  const enrichedFollowUps = followUps.map(followup => {
    // Add descriptive text for followup statuses
    let statusDescription = "";
    
    switch (followup.status) {
      case 'pending':
        statusDescription = "Scheduled";
        break;
      case 'completed':
        statusDescription = "Completed";
        break;
      case 'rescheduled':
        statusDescription = "Rescheduled";
        break;
      case 'missed':
        statusDescription = "Missed";
        break;
      default:
        statusDescription = followup.status;
    }
    
    // Calculate remaining time until scheduled followup
    const isOverdue = new Date(followup.scheduled) < new Date() && followup.status === 'pending';
    const timeUntil = getTimeUntil(followup.scheduled);
    
    return {
      ...followup,
      statusDescription,
      isOverdue,
      timeUntil: followup.status === 'pending' ? timeUntil : null,
    };
  });

  // Create response object with all related data
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        lead,
        followUps: enrichedFollowUps,
        activities: enrichedActivities,
      },
      'Lead fetched successfully!'
    )
  );
});

// @desc    Create new lead
// @route   POST /api/v1/leads
// @access  Private
const createLead = asyncHandler(async (req, res, next) => {
  // Add user to req.body
  req.body.assignedTo = req.user._id;

  // Check for lead rotation settings
  const settings = await CompanySetting.findOne();

  // If auto-rotation is enabled and user is admin, use rotation logic
  // if (true && true && req.user.role === 'employee') {
  //   const nextEmployee = await assignLeadToNextEmployee(req.body);
  //   req.body.assignedTo = nextEmployee._id;
  // }

  const nextEmployee = await assignLeadToNextEmployee(req.body);
  req.body.assignedTo = nextEmployee._id;

  const lead = await Lead.create(req.body);

  // Schedule initial follow-up if desired (default: 1 day)
  if (req.body.scheduleFollowUp !== false) {
    await scheduleFollowUp(
      lead,
      lead.assignedTo,
      req.body.followUpType || 'call',
      req.body.followUpInterval || null
    );
  }

  return res
    .status(201)
    .json(new ApiResponse(201, lead, 'Lead created successfully'));
});

// @desc    get leads from whataspp
// @route   POST /api/v1/lead/webhook
// @access  Private
const getLeadFromWhatsapp = asyncHandler(async (req, res) => {
  try {
    const { Body, From, ProfileName, MessageSid, SmsStatus } = req.body;

    // Log the full request body for debugging
    // console.log('📥 Full WhatsApp webhook:', JSON.stringify(req.body, null, 2));

    // Only process actual messages, ignore status updates
    if (
      SmsStatus &&
      (SmsStatus === 'delivered' ||
        SmsStatus === 'sent' ||
        SmsStatus === 'read')
    ) {
      // console.log(
      //   `📨 Ignoring status update webhook: ${SmsStatus} for ${MessageSid}`
      // );
      return res.status(200).send('Status update acknowledged');
    }

    if (!From) {
      // console.warn('⚠️ Missing From field in webhook:', req.body);
      return res.status(400).send('Invalid WhatsApp message payload');
    }

    // Skip processing if there's no actual message content
    if (!Body) {
      // console.log('⚠️ No message content, skipping lead processing for:', From);
      return res.status(200).send('Empty message acknowledged');
    }

    const phoneNumber = From.replace('whatsapp:', '');

    // Log important fields
    // console.log('📥 Processing WhatsApp message:', {
    //   phoneNumber,
    //   Body,
    //   ProfileName,
    //   MessageSid,
    // });

    let lead = await Lead.findOne({ phone: phoneNumber });
    let isNewLead = false;

    if (!lead) {
      isNewLead = true;
      // Default name from profile or phone
      let name = ProfileName || phoneNumber;

      // Try to extract name from Body
      if (Body && typeof Body === 'string') {
        const nameMatch = Body.match(/(?:my name is|I am|I'm) ([A-Za-z\s]+)/i);
        if (nameMatch && nameMatch[1]) {
          name = nameMatch[1].trim();
        }
      }

      // Create the lead
      lead = new Lead({
        name,
        phone: phoneNumber,
        message: Body, // We already checked Body exists
        source: 'whatsapp',
        messageSid: MessageSid, // Store the MessageSid to prevent duplicates
      });

      await lead.save();

      if (!lead) {
        throw new ApiError(500, 'Failed to create lead');
      }

      // Assign to employee
      const nextEmployee = await assignLeadToNextEmployee(lead);
      if (nextEmployee) {
        lead.assignedTo = nextEmployee._id;
        await lead.save();
        console.log(`👨‍💼 Lead assigned to employee: ${nextEmployee.name}`);
      } else {
        console.warn('⚠️ No employee available for assignment');
      }
    } else {
      // Check if this exact message was already processed (by MessageSid)
      if (lead.messageSid === MessageSid) {
        // console.log(
        //   `🔄 Duplicate message detected (MessageSid: ${MessageSid}), skipping update`
        // );
        return res.status(200).send('Duplicate message acknowledged');
      }

      // Update message history and MessageSid
      lead.message += `\n${Body}`;
      lead.messageSid = MessageSid; // Update the MessageSid to the latest
      await lead.save();
    }

    // Generate appropriate WhatsApp response
    const twiml = new MessagingResponse();
    if (isNewLead) {
      twiml.message(
        'Thank you for contacting us! One of our representatives will get in touch with you shortly.'
      );
    } else {
      twiml.message("Thanks for your message! We're working on your request.");
    }

    // Send response to WhatsApp
    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml.toString());

    // Log successful operation
    // console.log(
    //   `✅ WhatsApp lead ${isNewLead ? 'created' : 'updated'}: ${phoneNumber}`
    // );
  } catch (error) {
    // console.error('🔥 Error in WhatsApp webhook:', error);
    throw new ApiError(500, 'Server Error');
  }
});

// @desc    Update lead
// @route   PUT /api/v1/leads/:id
// @access  Private
const updateLead = asyncHandler(async (req, res, next) => {
  const { leadId } = req.params;

  let lead = await Lead.findById(leadId);

  if (!lead) {
    throw new ApiError(404, `Lead not found with id of ${leadId}`);
  }

  // Make sure user is lead owner or admin
  if (!lead.assignedTo.equals(req.user._id) && req.user.role !== 'admin') {
    throw new ApiError(
      401,
      `User ${req.user._id} is not authorized to update this lead`
    );
  }

  // Check if status is being updated
  const statusChanged = req.body.status && req.body.status !== lead.status;
  const oldStatus = lead.status;

  lead = await Lead.findByIdAndUpdate(leadId, req.body, {
    new: true,
    runValidators: true,
  });

  // If status changed, create an activity record
  if (statusChanged) {
    await Activity.create({
      lead: lead._id,
      user: req.user._id,
      type: 'note',
      status: 'completed',
      notes: `Lead status changed from ${oldStatus} to ${lead.status}`,
    });

    // Schedule follow-up based on new status if auto follow-up is enabled
    const settings = await CompanySetting.findOne();
    if (
      settings &&
      settings.autoFollowupEnabled &&
      lead.status !== 'closed-won' &&
      lead.status !== 'closed-lost'
    ) {
      await scheduleFollowUp(
        lead,
        lead.assignedTo,
        'call',
        settings.defaultFollowupIntervals[lead.status] || 2
      );
    }
  }

  return res
    .status(200)
    .json(new ApiResponse(200, lead, 'Lead updated successfully.'));
});

// @desc    Delete lead
// @route   DELETE /api/v1/leads/:id
// @access  Private
const deleteLead = asyncHandler(async (req, res, next) => {
  const { leadId } = req.params;

  const lead = await Lead.findById(leadId);

  if (!lead) {
    throw new ApiError(404, `Lead not found with id of ${leadId}`);
  }

  // Make sure user is lead owner or admin
  if (!lead.assignedTo.equals(req.user._id) && req.user.role !== 'admin') {
    throw new ApiError(
      401,
      `User ${req.user.name} is not authorized to delete this lead`
    );
  }

  // Delete lead and all related records (follow-ups, activities, etc.)
  await Promise.all([
    Lead.findByIdAndDelete(leadId),
    FollowUp.deleteMany({ lead: leadId }),
    Activity.deleteMany({ lead: leadId }),
  ]);

  return res.status(200).json(new ApiResponse(200, {}, 'Lead deleted.'));
});

// @desc    Assign lead to user
// @route   PUT /api/v1/leads/:id/assign
// @access  Private/Admin
const assignLead = asyncHandler(async (req, res, next) => {
  const { userId } = req.body;
  const { leadId } = req.params;

  if (!userId) {
    throw new ApiError(400, 'User Id is required');
  }

  let lead = await Lead.findById(leadId);

  if (!lead) {
    return next(new ErrorResponse(`Lead not found with id of ${leadId}`, 404));
  }

  // Make sure user is admin
  if (req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to assign leads`,
        401
      )
    );
  }

  // Update the lead's assigned user
  lead = await Lead.findByIdAndUpdate(
    leadId,
    { assignedTo: userId },
    {
      new: true,
      runValidators: true,
    }
  );

  // Create activity log
  await Activity.create({
    lead: lead._id,
    user: req.user._id,
    type: 'note',
    status: 'completed',
    notes: `Lead assigned to new employee`,
  });

  // Create notification for the new assignee
  const notificationService = require('../utils/notificationService');
  await notificationService.createNotification(
    userId,
    'Lead Assigned',
    `A lead (${lead.name}) has been assigned to you.`,
    'assignment',
    lead._id,
    'Lead'
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        lead,
        'lead is assigned to the new user successfully!'
      )
    );
});

// get activities based on user role
const getActivities = asyncHandler(async (req, res, next) => {
  try {
    // First check if there are any activities at all in the database
    const totalCount = await Activity.countDocuments({});
    console.log(`Total activities in database: ${totalCount}`);
    
    // Base pipeline stages
    const baseStages = [
      { $sort: { createdAt: -1 } },
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
  // Add match stage based on user role
  let matchStage = {};
  // If the user is an employee, only show their activities
  if (req.user.role !== 'admin') {
    // Convert req.user._id to ObjectId for proper matching
    matchStage = { $match: { user: new mongoose.Types.ObjectId(req.user._id.toString()) } };
    baseStages.unshift(matchStage);
  }

  // Limit the number of results (adjust as needed)
  const limitStage = { $limit: req.query.limit ? parseInt(req.query.limit) : 10 };
  baseStages.splice(1, 0, limitStage);
  
  // Add formatted fields and project needed fields
  const projectStage = {
    $project: {
      _id: 1,
      type: 1,
      status: 1,
      duration: 1,
      notes: 1,
      createdAt: 1,
      formattedDate: {
        $dateToString: { format: "%Y-%m-%d %H:%M", date: "$createdAt", timezone: "UTC" }
      },
      timeAgo: {
        $function: {
          body: function(createdAt) {
            const now = new Date();
            const created = new Date(createdAt);
            const diffMs = now - created;
            
            // Convert to appropriate units
            const diffSecs = Math.floor(diffMs / 1000);
            const diffMins = Math.floor(diffSecs / 60);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);
            
            if (diffDays > 0) {
              return diffDays + " day(s) ago";
            } else if (diffHours > 0) {
              return diffHours + " hour(s) ago";
            } else if (diffMins > 0) {
              return diffMins + " minute(s) ago";
            } else {
              return "just now";
            }
          },
          args: ["$createdAt"],
          lang: "js"
        }
      },
      activityLabel: {
        $switch: {
          branches: [
            { case: { $eq: ["$type", "call"] }, then: "Made a call" },
            { case: { $eq: ["$type", "whatsapp"] }, then: "Sent WhatsApp message" },
            { case: { $eq: ["$type", "email"] }, then: "Sent email" },
            { case: { $eq: ["$type", "meeting"] }, then: "Had a meeting" },
            { case: { $eq: ["$type", "note"] }, then: "Added a note" }
          ],
          default: "Interacted with lead"
        }
      },
      statusLabel: {
        $switch: {
          branches: [
            { case: { $eq: ["$status", "connected"] }, then: "Connected" },
            { case: { $eq: ["$status", "not-answered"] }, then: "No answer" },
            { case: { $eq: ["$status", "attempted"] }, then: "Attempted" },
            { case: { $eq: ["$status", "completed"] }, then: "Completed" }
          ],
          default: "$status"
        }
      },
      formattedDuration: {
        $cond: [
          { $gt: ["$duration", 0] },
          {
            $concat: [
              { $toString: { $floor: { $divide: ["$duration", 60] } } },
              "m ",
              { $toString: { $mod: ["$duration", 60] } },
              "s"
            ]
          },
          null
        ]
      },
      "userInfo.name": 1,
      "userInfo.email": 1,
      "userInfo._id": 1,
      "leadInfo.name": 1,
      "leadInfo.phone": 1,
      "leadInfo._id": 1,
      "leadInfo.status": 1
    }
  };
    baseStages.push(projectStage);  // Execute the aggregation pipeline
  console.log("Executing aggregation pipeline with stages:", JSON.stringify(baseStages, null, 2));
  
  let activities = [];
  try {
    activities = await Activity.aggregate(baseStages);
    console.log(`Aggregation returned ${activities ? activities.length : 0} activities`);
  } catch (aggError) {
    console.error("Aggregation pipeline error:", aggError);
    
    // Fallback to simple find query if aggregation fails
    console.log("Using fallback simple query method");
    const query = req.user.role !== 'admin' ? { user: req.user._id } : {};
    activities = await Activity.find(query)
      .sort({ createdAt: -1 })
      .limit(req.query.limit ? parseInt(req.query.limit) : 10)
      .populate('user', 'name email _id')
      .populate('lead', 'name phone _id status')
      .lean();
  }

  // Always return a valid response, with empty array if no activities
  return res
    .status(200)
    .json(new ApiResponse(200, { 
      count: activities.length,
      activities: activities || [],
      user: {
        id: req.user._id,
        role: req.user.role
      }
    }, activities.length > 0 ? "Activities fetched successfully" : "No activities found"));
  } catch (error) {
    console.error("Error fetching activities:", error);
    return res.status(500).json(new ApiResponse(500, null, "Error fetching activities"));
  }
});

export {
  getLeads,
  getLead,
  updateLead,
  deleteLead,
  assignLead,
  getLeadFromWhatsapp,
  getUserLeads,
  getActivities,
  createLead
};
