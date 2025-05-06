import { CallLog } from '../models/CallLogs.models.js';
import { Lead } from '../models/Lead.models.js';
import { User } from '../models/User.models.js';
import { Activity } from '../models/Activity.models.js';
import { makeCall, endCall } from '../utils/callService.js';

import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {
  getNextAvailableNumber,
  updateNumberUsage,
} from '../utils/phoneNumberRotation.js';
import asyncHandler from '../utils/asyncHandler.js';

// @route   POST api/calls/initiate
// @desc    Initiate a call to a lead
// @access  Private
const initiateCall = asyncHandler(async (req, res) => {
  const { leadId } = req.body;
  let call;
  if (!leadId) {
    throw new ApiError(400, 'Lead ID is required');
  }

  // Get lead
  const lead = await Lead.findById(leadId);
  if (!lead) {
    throw new ApiError(404, 'Lead not found');
  }

  if (!lead.assignedTo.equals(req.user._id) && req.user.role !== 'admin') {
    throw new ApiError(403, 'You are not autorized to make this call.');
  }

  // getting next nubmber
  const nextNumber = await getNextAvailableNumber();

  // Log activity
  const activity = new Activity({
    lead: leadId,
    user: req.user.id,
    type: 'call',
    status: 'attempted',
    notes: `Call initiated to ${lead.phoneNumber}`,
    templateUsed: null, // No WhatsApp template for calls
  });
  await activity.save();

  try {
    // Initiate call
    const callResponse = await makeCall(
      leadId,
      req.user._id,
      nextNumber.phoneNumber,
      lead.phone
    );

    

    return res
      .status(200)
      .json(new ApiResponse(200, call, 'Call initiated successfully'));
  } catch (error) {
    throw new ApiError(500, 'Failed to initiate call', error.message);
  }
});

// @route   POST api/calls/:id/end
// @desc    End an active call
// @access  Private
const dismissCall = asyncHandler(async (req, res) => {
  const call = await CallLog.findById(req.params.id);
  if (!call) {
    throw new ApiError(404, 'Call not found');
  }

  // Verify authorization
  if (call.user.toString() !== req.user.id) {
    throw new ApiError(401, 'Not authorized');
  }

  // Check call status
  if (!['ringing', 'connected'].includes(call.status)) {
    throw new ApiError(400, 'Call is not active');
  }

  // End call
  await endCall(call.callSid);

  // Update call log
  call.endTime = Date.now();
  call.status = 'connected';
  call.duration = Math.round((call.endTime - call.startTime) / 1000); // Duration in seconds
  await call.save();

  // Log activity
  const activity = new Activity({
    lead: call.lead,
    user: req.user.id,
    type: 'call',
    status: 'completed',
    duration: call.duration,
    notes: `Call ended for ${call.calledTo}`,
    templateUsed: null,
  });
  await activity.save();

  return res
    .status(200)
    .json(new ApiResponse(200, call, 'Call ended successfully'));
});

// @route   PUT api/calls/:id
// @desc    Update call details
// @access  Private
const updateCall = asyncHandler(async (req, res) => {
  const { notes, followUpScheduled } = req.body;

  const call = await CallLog.findById(req.params.id);
  if (!call) {
    throw new ApiError(404, 'Call not found');
  }

  // Verify authorization
  if (call.user.toString() !== req.user.id) {
    throw new ApiError(401, 'Not authorized');
  }

  // Update fields
  if (notes !== undefined) call.notes = notes;
  if (followUpScheduled !== undefined)
    call.followUpScheduled = followUpScheduled;

  await call.save();

  // Log activity
  const activity = new Activity({
    lead: call.lead,
    user: req.user.id,
    type: 'note',
    status: 'completed',
    notes: 'Call details updated',
    templateUsed: null,
  });
  await activity.save();

  return res
    .status(200)
    .json(new ApiResponse(200, call, 'Call updated successfully'));
});

// @route   GET api/calls
// @desc    Get all calls for current user
// @access  Private
const getCalls = asyncHandler(async (req, res) => {
  const calls = await CallLog.find({ user: req.user.id, isQueue: false })
    .populate('lead', 'firstName lastName phoneNumber')
    .sort({ startTime: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, calls, 'Calls retrieved successfully'));
});

// @route   GET api/calls/:id
// @desc    Get call by ID
// @access  Private
const getCallById = asyncHandler(async (req, res) => {
  const call = await CallLog.findById(req.params.id)
    .populate('lead', 'firstName lastName phoneNumber company email')
    .populate('user', 'name');

  if (!call || call.isQueue) {
    throw new ApiError(404, 'Call not found');
  }

  // Verify authorization
  if (call.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new ApiError(401, 'Not authorized');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, call, 'Call retrieved successfully'));
});

// @route   POST api/calls/queue
// @desc    Create a new call queue
// @access  Private
const createCallQueue = asyncHandler(async (req, res) => {
  const { name, description, leadIds, assignedAgentIds, maxAttempts } =
    req.body;

  if (!name || !leadIds) {
    throw new ApiError(400, 'Name and lead IDs are required');
  }

  // Validate leads
  const leads = await Lead.find({ _id: { $in: leadIds } });
  if (leads.length !== leadIds.length) {
    throw new ApiError(400, 'One or more leads not found');
  }

  // Validate agents
  if (assignedAgentIds?.length > 0) {
    const agents = await User.find({
      _id: { $in: assignedAgentIds },
      role: { $in: ['agent', 'manager'] },
    });
    if (agents.length !== assignedAgentIds.length) {
      throw new ApiError(400, 'One or more agents not found or invalid');
    }
  }

  // Format queue leads
  const queueLeads = leads.map((lead) => ({
    lead: lead._id,
    priority: 5,
    status: 'pending',
  }));

  // Create queue
  const newCallQueue = new CallLog({
    isQueue: true,
    name,
    description,
    leads: queueLeads,
    createdBy: req.user.id,
    assignedAgents: assignedAgentIds || [],
    maxAttempts: maxAttempts || 3,
  });

  const callQueue = await newCallQueue.save();

  // Log activity
  const activity = new Activity({
    user: req.user.id,
    type: 'note',
    status: 'completed',
    notes: `Call queue ${name} created`,
    templateUsed: null,
  });
  await activity.save();

  // Populate response
  await callQueue
    .populate('leads.lead', 'firstName lastName phoneNumber')
    .populate('assignedAgents', 'name email')
    .populate('createdBy', 'name');

  return res
    .status(201)
    .json(new ApiResponse(201, callQueue, 'Call queue created successfully'));
});

// @route   GET api/calls/queue/:id/next
// @desc    Get next lead from call queue
// @access  Private
const getNextQueueCall = asyncHandler(async (req, res) => {
  const callQueue = await CallLog.findById(req.params.id);
  if (!callQueue || !callQueue.isQueue) {
    throw new ApiError(404, 'Call queue not found');
  }

  // Verify authorization
  if (
    !callQueue.assignedAgents.some(
      (agent) => agent.toString() === req.user.id
    ) &&
    callQueue.createdBy.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    throw new ApiError(401, 'Not authorized to access this queue');
  }

  // Find next lead
  const nextLead = callQueue.leads
    .filter(
      (l) =>
        l.status === 'pending' ||
        (l.status === 'scheduled' && l.nextAttempt <= Date.now())
    )
    .sort((a, b) => b.priority - a.priority)[0];

  if (!nextLead) {
    return res
      .status(200)
      .json(new ApiResponse(200, null, 'No more leads in queue'));
  }

  // Get lead details
  const lead = await Lead.findById(nextLead.lead);
  if (!lead) {
    // Remove deleted lead
    callQueue.leads = callQueue.leads.filter(
      (l) => l.lead.toString() !== nextLead.lead.toString()
    );
    await callQueue.save();
    throw new ApiError(404, 'Lead no longer exists');
  }

  // Update queue lead
  nextLead.status = 'called';
  nextLead.attempts = (nextLead.attempts || 0) + 1;
  nextLead.lastAttempt = Date.now();
  await callQueue.save();

  // Log activity
  const activity = new Activity({
    lead: lead._id,
    user: req.user.id,
    type: 'call',
    status: 'attempted',
    notes: `Processed lead ${lead.phoneNumber} from queue`,
    templateUsed: null,
  });
  await activity.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        queueLeadId: nextLead._id,
        lead,
        attemptCount: nextLead.attempts,
        maxAttempts: callQueue.maxAttempts,
      },
      'Next lead retrieved successfully'
    )
  );
});

// @route   PUT api/calls/queue/lead/:id
// @desc    Update status of a lead in a queue
// @access  Private
const updateQueueLead = asyncHandler(async (req, res) => {
  const { status, nextAttempt, priority } = req.body;

  const queue = await CallLog.findOne({ 'leads._id': req.params.id });
  if (!queue || !queue.isQueue) {
    throw new ApiError(404, 'Queue lead not found');
  }

  // Verify authorization
  if (
    !queue.assignedAgents.some((agent) => agent.toString() === req.user.id) &&
    queue.createdBy.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    throw new ApiError(401, 'Not authorized to modify this queue');
  }

  // Find queue lead
  const queueLead = queue.leads.id(req.params.id);
  if (!queueLead) {
    throw new ApiError(404, 'Queue lead not found');
  }

  // Update fields
  if (status) queueLead.status = status;
  if (nextAttempt) queueLead.nextAttempt = new Date(nextAttempt);
  if (priority !== undefined) queueLead.priority = priority;

  await queue.save();

  // Log activity
  const activity = new Activity({
    lead: queueLead.lead,
    user: req.user.id,
    type: 'note',
    status: 'completed',
    notes: 'Queue lead status updated',
    templateUsed: null,
  });
  await activity.save();

  return res
    .status(200)
    .json(new ApiResponse(200, queueLead, 'Queue lead updated successfully'));
});

// @route   GET api/calls/queues
// @desc    Get all call queues for current user
// @access  Private
const getCallQueues = asyncHandler(async (req, res) => {
  const query =
    req.user.role !== 'admin'
      ? {
          $or: [{ assignedAgents: req.user.id }, { createdBy: req.user.id }],
        }
      : {};

  const queues = await CallLog.find({ ...query, isQueue: true })
    .populate('createdBy', 'name')
    .populate('assignedAgents', 'name email')
    .select('-leads.lead');

  return res
    .status(200)
    .json(new ApiResponse(200, queues, 'Call queues retrieved successfully'));
});

// @route   GET api/calls/queue/:id
// @desc    Get call queue by ID with leads
// @access  Private
const getCallQueueById = asyncHandler(async (req, res) => {
  const queue = await CallLog.findById(req.params.id)
    .populate('leads.lead', 'firstName lastName phoneNumber company email')
    .populate('createdBy', 'name')
    .populate('assignedAgents', 'name email');

  if (!queue || !queue.isQueue) {
    throw new ApiError(404, 'Call queue not found');
  }

  // Verify authorization
  if (
    !queue.assignedAgents.some((agent) => agent.toString() === req.user.id) &&
    queue.createdBy.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    throw new ApiError(401, 'Not authorized to access this queue');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, queue, 'Call queue retrieved successfully'));
});

export {
  initiateCall,
  dismissCall,
  updateCall,
  getCalls,
  getCallById,
  createCallQueue,
  getNextQueueCall,
  updateQueueLead,
  getCallQueues,
  getCallQueueById,
};
