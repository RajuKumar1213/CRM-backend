import { Router } from 'express';

import { verifyJWT } from '../middleware/auth.middleware.js';
import {
  createLead,
  deleteLead,
  getActivities,
  getLead,
  getLeadFromWhatsapp,
  getLeads,
  getUserLeads,
  updateLead,
} from '../controllers/lead.controller.js';
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

router.route('/webhook').post(getLeadFromWhatsapp);

export default router;
