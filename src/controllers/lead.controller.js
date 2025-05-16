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
  
  const minutes = Math.floor((diffMs % (1000 * 60)) / (1000 * 60));
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

  const leads = await Lead.find({}).populate('assignedTo', 'name email _id').lean();

  // For each lead, check if the latest follow-up is completed
  const leadIds = leads.map((lead) => lead._id);
  const followUps = await FollowUp.aggregate([
    { $match: { lead: { $in: leadIds } } },
    { $sort: { scheduled: -1 } },
    {
      $group: {
        _id: "$lead",
        latestStatus: { $first: "$status" },
        latestFollowUpId: { $first: "$_id" },
      },
    },
  ]);
  const followUpStatusMap = {};
  followUps.forEach((fu) => {
    followUpStatusMap[fu._id.toString()] = fu.latestStatus;
  });

  // Override status in response if latest follow-up is completed
  const leadsWithStatus = leads.map((lead) => {
    const latestFollowUpStatus = followUpStatusMap[lead._id.toString()];
    if (latestFollowUpStatus === "completed") {
      return { ...lead, status: "completed" };
    }
    return lead;
  });

  return res
    .status(200)
    .json(new ApiResponse(200, leadsWithStatus, 'Leads fetched successfully'));
});

// @desc    Get single lead
// @route   GET /api/v1/leads/:id
// @access  Privat
//

const getUserLeads = asyncHandler(async (req, res) => {
  // Extract search and filter parameters from query
  const { search, status, source, priority } = req.query;
  
  // Build the base query - always filter by current user's assigned leads
  let query = {
    assignedTo: req.user._id
  };
  
  // Add status filter if provided
  if (status && status !== 'All Statuses') {
    // Convert UI status label to database format if needed
    let dbStatus = status.toLowerCase();
    if (dbStatus === 'closed-won') dbStatus = 'won';
    if (dbStatus === 'closed-lost') dbStatus = 'lost';
    query.status = dbStatus;
  }
  
  // Add source filter if provided
  if (source && source !== 'All Sources') {
    query.source = source.toLowerCase();
  }
  
  // Add priority filter if provided
  if (priority && priority !== 'All Priorities') {
    query.priority = priority.toLowerCase();
  }
  
  // Add search term if provided - search in name, email, phone, product, and notes
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { product: { $regex: search, $options: 'i' } },
      { notes: { $regex: search, $options: 'i' } }
    ];
  }
  
  // Execute the query
  let leads = await Lead.find(query).select("-messageSid").lean();

  if (!leads) {
    throw new ApiError(404, "Leads not found");
  }

  // For each lead, check if the latest follow-up is completed
  const leadIds = leads.map((lead) => lead._id);
  const followUps = await FollowUp.aggregate([
    { $match: { lead: { $in: leadIds } } },
    { $sort: { scheduled: -1 } },
    {
      $group: {
        _id: "$lead",
        latestStatus: { $first: "$status" },
        latestFollowUpId: { $first: "$_id" },
      },
    },
  ]);
  const followUpStatusMap = {};
  followUps.forEach((fu) => {
    followUpStatusMap[fu._id.toString()] = fu.latestStatus;
  });

  // Override status in response if latest follow-up is completed
  leads = leads.map((lead) => {
    const latestFollowUpStatus = followUpStatusMap[lead._id.toString()];
    if (latestFollowUpStatus === "completed") {
      return { ...lead, status: "completed" };
    }
    return lead;
  });

  return res.status(200).json(new ApiResponse(200, leads, "Leads fetched successfully"));
});

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
    // });    let lead = await Lead.findOne({ phone: phoneNumber });
    let isNewLead = false;    if (!lead) {
      isNewLead = true;
      // Default name from profile or phone
      let name = ProfileName || phoneNumber;
      let interestedIn = '';
      let company = '';
      let status = 'new';

      // Try to extract information from Body
      if (Body && typeof Body === 'string') {
        // Extract name with improved patterns
        const nameMatch = Body.match(/(?:my name is|I am|I'm|this is|name[:\s-]+|call me) ([A-Za-z\s.]+?)(?:\.|,|\s+(?:from|at|of|and|looking|interested|I'm|need|want|with)|\s*$)/i);
        if (nameMatch && nameMatch[1]) {
          name = nameMatch[1].trim();
        }
        
        // Try to extract what they're interested in with improved patterns
        const interestedMatch = Body.match(/(?:interested in|looking for|need|want|inquir(?:y|ing) about|asking about|question about|info(?:rmation)? (?:on|about)|details (?:on|about)) ([^\.]+?)(?:\.|$)/i);
        if (interestedMatch && interestedMatch[1]) {
          interestedIn = interestedMatch[1].trim();
          // Set status to contacted since they've expressed interest
          status = 'contacted';
        }
        
        // Try to extract company name with improved patterns
        const companyMatch = Body.match(/(?:from|with|at|company[:\s-]+|business[:\s-]+|work(?:ing)? (?:at|for|with)|represent(?:ing)?)[\s]+([A-Za-z0-9\s&.]+?)(?:\.|,|\s+(?:and|looking|interested|I'm|need|want)|\s*$)/i);
        if (companyMatch && companyMatch[1] && !companyMatch[1].match(/^(a|the|my|our|their|this|that|from|with|at)$/i)) {
          company = companyMatch[1].trim();
        }
      }      // Create the lead
      lead = new Lead({
        name,
        phone: phoneNumber,
        message: Body, // We already checked Body exists
        source: 'whatsapp',
        messageSid: MessageSid, // Store the MessageSid to prevent duplicates
        interestedIn: interestedIn || undefined,
        company: company || undefined,
        status: status,
        priority: interestedIn ? 'high' : 'medium', // Set higher priority if they've mentioned interests
        lastContactMethod: 'whatsapp',
        lastContacted: new Date(),
        notes: `WhatsApp lead created on ${new Date().toLocaleString()}. Initial message: ${Body.substring(0, 100)}${Body.length > 100 ? '...' : ''}`
      });

      await lead.save();

      if (!lead) {
        throw new ApiError(500, 'Failed to create lead');
      }

      // Schedule an initial follow-up
      let followUpInterval = 1; // Default: 1 day
      const nextEmployee = await assignLeadToNextEmployee(lead);
      if (nextEmployee) {
        lead.assignedTo = nextEmployee._id;
        await lead.save();
        console.log(`👨‍💼 Lead assigned to employee: ${nextEmployee.name}`);
        
        // Schedule a WhatsApp follow-up
        await scheduleFollowUp(
          lead,
          nextEmployee._id,
          'whatsapp', // Follow-up type specifically for WhatsApp leads
          followUpInterval
        );
      } else {
        console.warn('⚠️ No employee available for assignment');
      }    } else {
      // Check if this exact message was already processed (by MessageSid)
      if (lead.messageSid === MessageSid) {
        // console.log(
        //   `🔄 Duplicate message detected (MessageSid: ${MessageSid}), skipping update`
        // );
        return res.status(200).send('Duplicate message acknowledged');
      }

      // Update message history and MessageSid
      lead.message = lead.message ? `${lead.message}\n${Body}` : Body;
      lead.messageSid = MessageSid; // Update the MessageSid to the latest
      lead.lastContactMethod = 'whatsapp';
      lead.lastContacted = new Date();
      
      // Check if we can extract any additional information
      if (Body && typeof Body === 'string') {
        // Try to extract what they're interested in if not already set
        if (!lead.interestedIn) {
          const interestedMatch = Body.match(/(?:interested in|looking for|need|want|inquir(?:y|ing) about|asking about|question about|info(?:rmation)? (?:on|about)|details (?:on|about)) ([^\.]+?)(?:\.|$)/i);
          if (interestedMatch && interestedMatch[1]) {
            lead.interestedIn = interestedMatch[1].trim();
            // Update priority based on interest
            lead.priority = 'high';
          }
        }
        
        // Try to extract company name if not already set
        if (!lead.company) {
          const companyMatch = Body.match(/(?:from|with|at|company[:\s-]+|business[:\s-]+|work(?:ing)? (?:at|for|with)|represent(?:ing)?)[\s]+([A-Za-z0-9\s&.]+?)(?:\.|,|\s+(?:and|looking|interested|I'm|need|want)|\s*$)/i);
          if (companyMatch && companyMatch[1] && !companyMatch[1].match(/^(a|the|my|our|their|this|that|from|with|at)$/i)) {
            lead.company = companyMatch[1].trim();
          }
        }
      }
      
      // Update the lead status if it's still 'new'
      if (lead.status === 'new') {
        lead.status = 'contacted';
      }
      
      await lead.save();
    }    // Generate appropriate WhatsApp response
    const twiml = new MessagingResponse();
    if (isNewLead) {
      // Personalized welcome message for new leads
      let welcomeMsg = `Thank you for contacting us, ${lead.name.split(' ')[0]}! One of our representatives will get in touch with you shortly.`;
      
      // Ask for additional information if missing
      if (!lead.interestedIn) {
        welcomeMsg += `\n\nTo help us serve you better, could you please let us know what you're interested in?`;
      } else if (!lead.company) {
        welcomeMsg += `\n\nMay we know which company you represent?`;
      } else {
        welcomeMsg += `\n\nWe look forward to discussing your interest in ${lead.interestedIn}.`;
      }
      
      twiml.message(welcomeMsg);
      
      // Create an activity for the new lead
      await Activity.create({
        lead: lead._id,
        user: lead.assignedTo || null,
        type: 'whatsapp',
        status: 'completed',
        notes: 'New lead created from WhatsApp',
      });
    } else {
      // Personalized response for returning leads
      let responseMsg = `Thanks for your message, ${lead.name.split(' ')[0]}!`;
      
      // Add contextual information if available
      if (lead.assignedTo) {
        const assignedUser = await User.findById(lead.assignedTo);
        if (assignedUser) {
          responseMsg += ` ${assignedUser.name} will respond to you as soon as possible.`;
        } else {
          responseMsg += ` Our team will respond to you as soon as possible.`;
        }
      } else {
        responseMsg += ` Our team will respond to you as soon as possible.`;
      }
      
      twiml.message(responseMsg);
      
      // Create an activity for the follow-up message
      await Activity.create({
        lead: lead._id,
        user: lead.assignedTo || null,
        type: 'whatsapp',
        status: 'completed',
        notes: `Follow-up message received: ${Body.substring(0, 50)}${Body.length > 50 ? '...' : ''}`,
      });
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
  // Validate status if it's being updated
  if (statusChanged) {
    const validStatuses = ['new', 'contacted', 'qualified', 'negotiating', 'in-progress', 'proposal-sent', 'won', 'lost', 'on-hold'];
    if (!validStatuses.includes(req.body.status)) {
      throw new ApiError(400, `Invalid status value. Must be one of: ${validStatuses.join(', ')}`);
    }
  }

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
    });    // Schedule follow-up based on new status if auto follow-up is enabled
    const settings = await CompanySetting.findOne();
    if (
      settings &&
      settings.autoFollowupEnabled &&
      lead.status !== 'won' &&
      lead.status !== 'lost'
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

// @desc    Get activities by user role
// @route   GET /api/v1/leads/activities
// @access  Private
const getActivities = asyncHandler(async (req, res) => {
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
    
    // Get limit and page from query or use default
    const page = parseInt(req.query.page) || 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const skip = (page - 1) * limit;

    // Use find() instead of aggregate for better compatibility
    const activities = await Activity.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email _id')
      .populate('lead', 'name phone _id status')
      .populate('templateUsed', 'name content')
      .lean();

    console.log(`Found ${activities.length} activities`);

    // Enrich the activities with computed fields
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

      // Map activity type to label
      const activityLabel = {
        call: "Made a call",
        whatsapp: "Sent WhatsApp message",
        email: "Sent email",
        meeting: "Had a meeting",
        note: "Added a note"
      }[activity.type] || "Interacted with lead";

      // Map status to label
      const statusLabel = {
        connected: "Connected",
        "not-answered": "No answer",
        attempted: "Attempted",
        completed: "Completed"
      }[activity.status] || activity.status;

      // Format duration for calls
      let formattedDuration = null;
      if (activity.duration && activity.duration > 0) {
        const minutes = Math.floor(activity.duration / 60);
        const seconds = activity.duration % 60;
        formattedDuration = `${minutes}m ${seconds}s`;
      }

      // Format date
      const formattedDate = new Date(activity.createdAt).toISOString().replace('T', ' ').substring(0, 16);

      return {
        ...activity,
        timeAgo,
        activityLabel,
        statusLabel,
        formattedDuration,
        formattedDate,
        // Keep both user/lead and userInfo/leadInfo for backward compatibility
        userInfo: activity.user,
        leadInfo: activity.lead
      };
    });

    return res.status(200).json(new ApiResponse(200, { 
      count: enrichedActivities.length,
      activities: enrichedActivities,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalActivities: totalCount,
        hasMore: skip + activities.length < totalCount
      },
      user: {
        id: req.user._id,
        role: req.user.role
      }
    }, enrichedActivities.length > 0 ? "Activities fetched successfully" : "No activities found"));

  } catch (error) {
    console.error("Error fetching activities:", error);
    throw new ApiError(500, "Error fetching activities: " + error.message);
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
