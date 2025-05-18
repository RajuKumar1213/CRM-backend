import { Router } from 'express';
import express from 'express';

import { verifyJWT } from '../middleware/auth.middleware.js';
import {
  createLead,
  deleteLead,
  getActivities,
  getLead,
  getLeads,
  getUserLeads,
  updateLead,
} from '../controllers/lead.controller.js';
import { handleWhatsAppWebhook } from '../controllers/fixed-webhook.js';
import { getFollowUps } from '../controllers/followUp.controller.js';

const router = Router();

router.route('/get-leads').get(verifyJWT, getLeads);
router.route("/get-user-leads").get(verifyJWT, getUserLeads)
router.route('/get-lead/:leadId').get(verifyJWT, getLead);
router.route('/create').post(verifyJWT, createLead);
router.route('/update/:leadId').patch(verifyJWT, updateLead);
router.route('/delete/:leadId').delete(verifyJWT, deleteLead);
router.route('/activities').get(verifyJWT, getActivities);
router.route('/followups').get(verifyJWT, getFollowUps);

// Twilio webhook doesn't use authentication since it's called by Twilio servers
// Using a direct router.post() instead of router.route() for clarity
router.post('/webhook/whatsapp/incoming', express.urlencoded({ extended: true }), handleWhatsAppWebhook);

// Adding a second route for compatibility with client-side code
router.post('/webhook', express.urlencoded({ extended: true }), handleWhatsAppWebhook);

export default router;
