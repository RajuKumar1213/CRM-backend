import asyncHandler from '../utils/asyncHandler.js';

import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { assignLeadToNextEmployee } from '../utils/leadRotation.js';
import { scheduleFollowUp } from '../utils/followUpScheduler.js';
import { Lead } from '../models/Lead.models.js';
import { FollowUp } from '../models/FollowUp.models.js';
import { Activity } from '../models/Activity.models.js';
import { CompanySetting } from '../models/CompanySettings.models.js';
import twilio from 'twilio';
import dotenv from 'dotenv';

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

  const lead = await Lead.findById(leadId).populate('assignedTo', 'name email');

  if (!lead) {
    throw new ApiError(404, 'Lead not found');
  }

  // Make sure user is lead owner or admin
  if (!lead.assignedTo._id.equals(req.user._id) && req.user.role !== 'admin') {
    throw new ApiError(401, 'User is not authorized to view this lead');
  }

  // Get follow-ups and activities for this lead
  const followUps = await FollowUp.find({ lead: leadId })
    .sort('-scheduled')
    .populate('assignedTo', 'name');
  const activities = await Activity.find({ lead: leadId })
    .sort('-createdAt')
    .populate('user', 'name');

  // Create response object with all related data

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        lead,
        followUps,
        activities,
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

// get all activities for admin
const getActivities = asyncHandler(async (req, res, next) => {
  const activities = await Activity.aggregate([
    { $sort: { createdAt: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: "users", // Make sure this matches your collection name!
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
        from: "leads", // Make sure this matches your collection name!
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
    },
    {
      $project: {
        _id: 1,
        type: 1,
        status: 1,
        duration: 1,
        notes: 1,
        createdAt: 1,
        "userInfo.name": 1,
        "userInfo.email": 1,
        "leadInfo.name": 1,
        "leadInfo.phone": 1,
      }
    }
  ]);

  if (!activities || activities.length === 0) {
    throw new ApiError(404, "No activities found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, activities, "Latest activities fetched successfully"));
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
