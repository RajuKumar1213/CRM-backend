import { Router } from 'express';

import { verifyJWT } from '../middleware/auth.middleware.js';
import {
  createCompanySetting,
  updateCompanySetting,
} from '../controllers/setting.controller.js';

const router = Router();

router.route('/create').post(verifyJWT, createCompanySetting);
router.route('/update/:id').patch(verifyJWT, updateCompanySetting);

export default router;
