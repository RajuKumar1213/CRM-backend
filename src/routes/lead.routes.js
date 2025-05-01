import { Router } from 'express';

import { verifyJWT } from '../middleware/auth.middleware.js';
import { getLead, getLeads } from '../controllers/lead.controller.js';

const router = Router();

router.route('/get-leads').get(verifyJWT, getLeads);
router.route('/get-lead/:leadId').get(verifyJWT, getLead);

export default router;
