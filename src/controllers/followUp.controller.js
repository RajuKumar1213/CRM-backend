// controllers/followUpController.js

import { Lead } from '../models/Lead.models.js';
import { Activity } from '../models/Activity.models.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { scheduleFollowUp } from '../utils/followUpScheduler.js';
import { Notification } from '../models/Notification.models.js';
import { FollowUp } from '../models/FollowUp.models.js';

// @desc    Get all follow-ups
// @route   GET /api/v1/followups
// @route   GET /api/v1/leads/:leadId/followups
// @access  Private
const getFollowUps = asyncHandler(async (req, res, next) => {
  let query;
  const { leadId } = req.params;

  if (leadId) {
    // If route is nested, get follow-ups for specific lead
    query = FollowUp.find({ lead: leadId });

    // If not admin, make sure user only sees their own follow-ups
    if (req.user.role !== 'admin') {
      query = query.where({ assignedTo: req.user._id });
    }
  } else {
    // If direct route, get all follow-ups
    // If not admin, make sure user only sees their own follow-ups
    if (req.user.role !== 'admin') {
      query = FollowUp.find({ assignedTo: req.user._id });
    } else {
      query = FollowUp.find();
    }
  }

  // Copy req.query
  const reqQuery = { ...req.query };

  // Fields to exclude
  const removeFields = ['select', 'sort', 'page', 'limit'];

  // Loop over removeFields and delete them from reqQuery
  removeFields.forEach((param) => delete reqQuery[param]);

  // Create query string
  let queryStr = JSON.stringify(reqQuery);

  // Create operators ($gt, $gte, etc)
  queryStr = queryStr.replace(
    /\b(gt|gte|lt|lte|in)\b/g,
    (match) => `$${match}`
  );

  // Merge query parameters
  query = query.find(JSON.parse(queryStr));

  // Add relations
  query = query
    .populate({
      path: 'lead',
      select: 'name phone email company',
    })
    .populate({
      path: 'assignedTo',
      select: 'name email',
    });

  // Select Fields
  if (req.query.select) {
    const fields = req.query.select.split(',').join(' ');
    query = query.select(fields);
  }

  // Sort
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('scheduled');
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 25;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await FollowUp.countDocuments(
    leadId ? { lead: leadId, ...JSON.parse(queryStr) } : JSON.parse(queryStr)
  );

  query = query.skip(startIndex).limit(limit);

  // Executing query
  const followUps = await query;

  // Pagination result
  const pagination = {};

  if (endIndex < total) {
    pagination.next = {
      page: page + 1,
      limit,
    };
  }

  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit,
    };
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { count: followUps.length, pagination, followUps },
        'followups fetched successfully'
      )
    );
});

// @desc    Get single follow-up
// @route   GET /api/v1/followups/:id
// @access  Private
const getFollowUp = asyncHandler(async (req, res) => {
  const { leadId } = req.params;

  const followUp = await FollowUp.findById(leadId)
    .populate({
      path: 'lead',
      select: 'name phone email company status',
    })
    .populate({
      path: 'assignedTo',
      select: 'name email',
    });

  if (!followUp) {
    throw new ApiError(404, `Follow-up not found with id of ${leadId}`);
  }

  // Make sure user is follow-up owner or admin
  if (
    !followUp.assignedTo._id.equals(req.user._id) &&
    req.user.role !== 'admin'
  ) {
    throw new ApiError(
      401,
      `User ${req.user._id} is not authorized to view this follow-up`
    );
  }

  res.status(200).json({
    success: true,
    data: followUp,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, followUp, 'Lead fetched successfully!'));
});

// @desc    Create follow-up
// @route   POST /api/v1/leads/:leadId/followups
// @access  Private
const createFollowUp = asyncHandler(async (req, res, next) => {
  const { leadId } = req.params;
  req.body.lead = leadId;
  req.body.assignedTo = req.body.assignedTo || req.user._id;

  const lead = await Lead.findById(leadId);

  if (!lead) {
    throw new ApiError(404, `Lead not found with id of ${leadId}`);
  }

  // Make sure user is lead owner or admin
  if (!lead.assignedTo.equals(req.user._id) && req.user.role !== 'admin') {
    throw new ApiError(
      401,
      `User ${req.user._id} is not authorized to create a follow-up for this lead`
    );
  }

  // Set followUp status to lead status if not provided
  if (!req.body.status) {
    req.body.status = lead.status || 'new';
  }
  const followUp = await FollowUp.create(req.body);

  // Update lead status if this is the first follow-up and lead is new
  if (lead.status === 'new' && req.body.status !== 'missed') {
    // Update lead status to 'contacted' since we're now scheduling follow-ups
    await Lead.findByIdAndUpdate(leadId, { status: 'contacted' });
    
    // Log the status change activity
    await Activity.create({
      lead: lead._id,
      user: req.user._id,
      type: 'note',
      status: 'completed',
      notes: `Lead status changed from new to contacted due to follow-up creation`,
    });
  }

  // Create notification for the assignee if different from creator
  if (req.body.assignedTo && req.body.assignedTo !== req.user._id) {
    await Notification.createNotification(
      req.body.assignedTo,
      'Follow-Up Assigned',
      `A follow-up for lead ${lead.name} has been assigned to you for ${new Date(followUp.scheduled).toLocaleDateString()}.`,
      'followup',
      followUp._id,
      'FollowUp'
    );
  }

  return res
    .status(201)
    .json(new ApiResponse(201, followUp, 'Follow-up created successfully!'));
});

// @desc    Update follow-up
// @route   PUT /api/v1/followups/:id
// @access  Private
const updateFollowUp = asyncHandler(async (req, res) => {
  const { followUpId } = req.params;

  let followUp = await FollowUp.findById(followUpId);

  if (!followUp) {
    throw new ApiError(404, `Follow-up not found with id of ${followUpId}`);
  }

  // Make sure user is follow-up owner or admin
  if (!followUp.assignedTo.equals(req.user._id) && req.user.role !== 'admin') {
    throw new ApiError(
      401,
      `User ${req.user._id} is not authorized to update this follow-up`
    );
  }

  // Check if status changed and add log
  const statusChanged =
    req.body.status &&
    req.body.status !== followUp.status;

  followUp = await FollowUp.findByIdAndUpdate(followUpId, req.body, {
    new: true,
    runValidators: true,
  });

  // If status changed, update the lead status accordingly
  if (statusChanged) {
    // Find the associated lead
    const lead = await Lead.findById(followUp.lead);
    
    if (lead) {
      let shouldUpdateLead = false;
      let newLeadStatus = lead.status;
        // Map follow-up status and outcome to lead status
      switch(req.body.status) {
        case 'completed':
          // When follow-up is completed, update lead status based on outcome
          switch(req.body.outcome) {
            case 'qualified':
              newLeadStatus = 'qualified';
              shouldUpdateLead = true;
              break;
            case 'negotiating':
              newLeadStatus = 'negotiating';
              shouldUpdateLead = true;
              break;
            case 'proposal-sent':
              newLeadStatus = 'proposal-sent';
              shouldUpdateLead = true;
              break;
            case 'won':
              newLeadStatus = 'won';
              shouldUpdateLead = true;
              break;
            case 'lost':
              newLeadStatus = 'lost';
              shouldUpdateLead = true;
              break;
            default:
              // If lead is new and follow-up is completed, mark as contacted
              if (lead.status === 'new') {
                newLeadStatus = 'contacted';
                shouldUpdateLead = true;
              }
          }
          break;
        case 'rescheduled':
          if (!lead.status || lead.status === 'new') {
            newLeadStatus = 'contacted';
            shouldUpdateLead = true;
          }
          break;
        case 'missed':
          // Don't change lead status on missed follow-ups
          break;
        case 'cancelled':
          // Optionally mark lead as on-hold when follow-up is cancelled
          if (req.body.outcome === 'on-hold') {
            newLeadStatus = 'on-hold';
            shouldUpdateLead = true;
          }
          break;
        case 'in-progress':
          if (lead.status === 'new') {
            newLeadStatus = 'contacted';
            shouldUpdateLead = true;
          }
          break;
        case 'on-hold':
          newLeadStatus = 'on-hold';
          shouldUpdateLead = true;
          break;
      }
      
      // Update the lead status if needed
      if (shouldUpdateLead) {
        await Lead.findByIdAndUpdate(lead._id, { status: newLeadStatus });
        
        // Log activity for status change
        await Activity.create({
          lead: lead._id,
          user: req.user._id,
          type: 'note',
          status: 'completed',
          notes: `Lead status changed from ${lead.status} to ${newLeadStatus} due to follow-up status change`,
        });
      }
    }
  }

  // Always update the lead status to match the followUp status if it changed
  if (statusChanged) {    // Only set allowed lead status values
    let allowedStatuses = ['new', 'contacted', 'qualified', 'negotiating', 'in-progress', 'proposal-sent', 'won', 'lost', 'on-hold'];
    let statusToSet = allowedStatuses.includes(req.body.outcome) ? req.body.outcome : undefined;
    if (statusToSet) {
      await Lead.findByIdAndUpdate(followUp.lead, { status: statusToSet });
      // Optionally, log activity for status change
      await Activity.create({
        lead: followUp.lead,
        user: req.user._id,
        type: 'note',
        status: 'completed',
        notes: `Lead status changed to ${statusToSet} due to follow-up status change`,
      });
    }
  }

  // If status changed to completed, log activity
  if (statusChanged && req.body.status === 'completed') {
    await Activity.create({
      user: req.user._id,
      lead: followUp.lead,
      action: 'follow-up-completed',
      type: followUp.followUpType,
      description: `Completed follow-up: ${followUp.title || 'Follow-up'}`,
      referenceId: followUp._id,
      referenceModel: 'FollowUp',
    });
  }

  // If scheduled date changed, update the scheduler
  if (
    req.body.scheduled &&
    req.body.scheduled !== followUp.scheduled.toISOString()
  ) {
    await scheduleFollowUp(followUp);
  }

  // If assignee changed, create notification
  if (
    req.body.assignedTo &&
    req.body.assignedTo !== followUp.assignedTo.toString()
  ) {
    await Notification.createNotification(
      req.body.assignedTo,
      'Follow-Up Reassigned',
      `A follow-up has been reassigned to you for ${new Date(followUp.scheduled).toLocaleDateString()}.`,
      'followup',
      followUp._id,
      'FollowUp'
    );
  }

  

  return res
    .status(200)
    .json(new ApiResponse(200, followUp, 'Follow-up updated successfully!'));
});

// @desc    Delete follow-up
// @route   DELETE /api/v1/followups/:id
// @access  Private
const deleteFollowUp = asyncHandler(async (req, res, next) => {
  const { followUpId } = req.params;

  const followUp = await FollowUp.findById(followUpId);

  if (!followUp) {
    throw new ApiError(404, `Follow-up not found with id of ${followUpId}`);
  }

  // Make sure user is follow-up owner or admin
  if (!followUp.assignedTo.equals(req.user._id) && req.user.role !== 'admin') {
    throw new ApiError(
      401,
      `User ${req.user._id} is not authorized to delete this follow-up`
    );
  }

  await followUp.deleteOne();

  return res.status(200).json(new ApiResponse(200, {}, 'Follow-up deleted.'));
});

// @desc    Complete follow-up
// @route   PUT /api/v1/followups/:id/complete
// @access  Private
const completeFollowUp = asyncHandler(async (req, res, next) => {
  const { followUpId } = req.params;
  const followUp = await FollowUp.findById(followUpId);

  if (!followUp) {
    throw new ApiError(404, `Follow-up not found with id of ${followUpId}`);
  }

  // Make sure user is follow-up owner or admin
  if (!followUp.assignedTo.equals(req.user._id) && req.user.role !== 'admin') {
    throw new ApiError(
      401,
      `User ${req.user._id} is not authorized to delete this follow-up`
    );
  }

  followUp.status = 'completed';
  followUp.completedAt = Date.now();
  followUp.notes = req.body.notes || followUp.notes;
  followUp.outcome = req.body.outcome;

  await followUp.save();

  // Log activity
  await Activity.create({
    user: req.user.id,
    lead: followUp.lead,
    type: followUp.followUpType,
    action: 'follow-up-completed',
    description: `Completed follow-up: ${followUp.title}`,
    referenceId: followUp._id,
    referenceModel: 'FollowUp',
  });

  return res
    .status(200)
    .json(new ApiResponse(200, followUp, 'Follow-up completed.'));
});

// @desc    Get today's follow-ups for current user
// @route   GET /api/v1/followups/today
// @access  Private
const getTodayFollowUps = asyncHandler(async (req, res) => {
  const today = new Date();
today.setHours(0, 0, 0, 0);

const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);

const followUps = await FollowUp.aggregate([
  {
    $match: {
      assignedTo: req.user._id,
      status: { $ne: 'completed' },
      scheduled: {
        $gte: today,
        $lt: tomorrow
      }
    }
  },
  {
    $lookup: {
      from: 'leads',
      localField: 'lead',
      foreignField: '_id',
      as: 'lead'
    }
  },
  {
    $unwind: '$lead'
  },
  {
    $project: {
      scheduled: 1,
      status: 1,
      'lead._id': 1,
      'lead.name': 1,
      'lead.phone': 1,
      'lead.email': 1,
      'lead.company': 1,
      'lead.status': 1
    }
  }
]);

  

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { count: followUps.length, followUps },
        "Today's followups fetched successfully"
      )
    );
});

// @desc    Get overdue follow-ups for current user
// @route   GET /api/v1/followups/overdue
// @access  Private
const getOverdueFollowUps = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Midnight today

  const followUps = await FollowUp.aggregate([
    {
      $match: {
        assignedTo: req.user._id,
        status: { $ne: 'completed' },
        scheduled: { $lt: today } // Anything before today
      }
    },
    {
      $lookup: {
        from: 'leads',
        localField: 'lead',
        foreignField: '_id',
        as: 'lead'
      }
    },
    {
      $unwind: '$lead'
    },
    {
      $project: {
        scheduled: 1,
        status: 1,
        'lead._id': 1,
        'lead.name': 1,
        'lead.phone': 1,
        'lead.email': 1,
        'lead.company': 1,
        'lead.status': 1
      }
    }
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      { count: followUps.length, followUps },
      'Overdue followups fetched successfully'
    )
  );
});

// @desc    Get upcoming follow-ups for current user
// @route   GET /api/v1/followups/upcoming
// @access  Private
const getUpcomingFollowUps = asyncHandler(async (req, res, next) => {
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const nextWeek = new Date(tomorrow);
  nextWeek.setDate(nextWeek.getDate() + 6); // total 7 days from today

  const followUps = await FollowUp.find({
    assignedTo: req.user._id,
    scheduled: {
      $gte: tomorrow,
      $lte: nextWeek,
    },
    status: { $ne: 'completed' },
  }).populate({
    path: 'lead',
    select: 'name phone email company status',
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        count: followUps.length,
        data: followUps,
      },
      'Upcoming followups fetched successfully'
    )
  );
});


// @desc    Snooze a follow-up
// @route   PUT /api/v1/followups/:id/snooze
// @access  Private
const snoozeFollowUp = asyncHandler(async (req, res, next) => {
  if (!req.body.snoozeUntil) {
    return next(new ErrorResponse('Please provide a snooze date', 400));
  }

  const followUp = await FollowUp.findById(id);

  if (!followUp) {
    return next(new ErrorResponse(`No follow-up with the id of ${id}`), 404);
  }

  // Make sure user is follow-up owner or admin
  if (
    followUp.assignedTo.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to snooze this follow-up`,
        401
      )
    );
  }

  followUp.scheduled = new Date(req.body.snoozeUntil);
  followUp.snoozed = true;
  followUp.snoozedFrom = followUp.scheduled;

  await followUp.save();

  // Update scheduler
  await scheduleFollowUp(followUp);

  // Log activity
  await Activity.create({
    user: req.user.id,
    lead: followUp.lead,
    action: 'follow-up-snoozed',
    description: `Snoozed follow-up: ${followUp.title} until ${new Date(followUp.scheduled).toLocaleDateString()}`,
    referenceId: followUp._id,
    referenceModel: 'FollowUp',
  });

  res.status(200).json({
    success: true,
    data: followUp,
  });
});

// @desc    Get all follow-ups for a specific lead
// @route   GET /api/v1/followups/lead/:leadId
// @access  Private
const getLeadFollowUps = asyncHandler(async (req, res) => {
  const { leadId } = req.params;

  // Validate leadId
  if (!leadId) {
    throw new ApiError(400, 'Lead ID is required');
  }

  // Find the lead to verify ownership/access
  const lead = await Lead.findById(leadId);
  if (!lead) {
    throw new ApiError(404, `Lead not found with id of ${leadId}`);
  }

  // Make sure user is lead owner or admin
  if (!lead.assignedTo.equals(req.user._id) && req.user.role !== 'admin') {
    throw new ApiError(
      401,
      `User ${req.user._id} is not authorized to view follow-ups for this lead`
    );
  }

  // Get all follow-ups for this lead, sorted by scheduled date (most recent first)
  const followUps = await FollowUp.find({ lead: leadId })
    .sort('-scheduled')
    .populate({
      path: 'assignedTo',
      select: 'name email'
    });

  // Optional sort parameter with default sorting
  if (!followUps.length) {
    return res.status(200).json(
      new ApiResponse(
        200,
        { count: 0, followUps: [] },
        'No follow-ups found for this lead'
      )
    );
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { count: followUps.length, followUps },
      'Lead follow-ups fetched successfully'
    )
  );
});

export {
  getFollowUp,
  getFollowUps,
  deleteFollowUp,
  createFollowUp,
  updateFollowUp,
  completeFollowUp,
  getOverdueFollowUps,
  getTodayFollowUps,
  getUpcomingFollowUps,
  snoozeFollowUp,
  getLeadFollowUps,
};
