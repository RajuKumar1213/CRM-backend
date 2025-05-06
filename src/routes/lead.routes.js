import { Router } from 'express';

import { verifyJWT } from '../middleware/auth.middleware.js';
import {
  // createLead,
  deleteLead,
  getLead,
  getLeadFromWhatsapp,
  getLeads,
  updateLead,
} from '../controllers/lead.controller.js';

const router = Router();

router.route('/get-leads').get(verifyJWT, getLeads);
router.route('/get-lead/:leadId').get(verifyJWT, getLead);
// router.route('/create').post(verifyJWT, createLead);
router.route('/update/:leadId').patch(verifyJWT, updateLead);
router.route('/delete/:leadId').delete(verifyJWT, deleteLead);

router.route('/webhook').post(getLeadFromWhatsapp);

export default router;
