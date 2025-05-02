import { Router } from 'express';

import { verifyJWT } from '../middleware/auth.middleware.js';
import {
  createWhatsappTemplate,
  getWhatsappTemplate,
  getWhatsappTemplates,
} from '../controllers/watsapp.controller.js';
import { sendWhatsAppMessage } from '../utils/watsappService.js';

const router = Router();

router.route('/send/:leadId').post(verifyJWT, sendWhatsAppMessage);
router.route('/get-watsapp-templates').get(verifyJWT, getWhatsappTemplates);
router
  .route('/get-watsapp-template/:templateId')
  .get(verifyJWT, getWhatsappTemplate);
router
  .route('/watsapp-template/create')
  .post(verifyJWT, createWhatsappTemplate);

export default router;
