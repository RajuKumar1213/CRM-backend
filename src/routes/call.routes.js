import { Router } from 'express';
import { initiateCall } from '../controllers/call.controller.js';
import { verifyJWT } from '../middleware/auth.middleware.js';

const router = Router();

router.route('/initiate').post(verifyJWT, initiateCall);

export default router;
