import { Router } from "express";
import { getUser, loginUser, logoutUser, registerUser, updateAccountDetails, updatePassword } from "../controllers/auth.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

router.route("/register").post(registerUser );
router.route("/login").post(loginUser);   

// secured routes
router.route("/logout").post(verifyJWT, logoutUser)
router.route("/get-user").get(verifyJWT, getUser)
router.route("/update-account-details").patch(verifyJWT, updateAccountDetails);
router.route("/update-password").patch(verifyJWT, updatePassword);







export default router;