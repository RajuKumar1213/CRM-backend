import asyncHandler from "../utils/asyncHandler.js"
import { User } from '../models/User.models.js';
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // updating user with  referesh token
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      'Something went wrong while generating access and referesh token.'
    );
  }
};


// @desc    Register user
// @route   POST /api/v1/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {

  try {
    const {name, email,phone, password, role } = req.body;

    // validating
    if (
      [name, email, phone, password, role].some(
        (field) => field?.trim() === ''
      )
    ) {
      throw new ApiError(400, 'All fields are required');
    }

    // check if user already exists
    const existedUser = await User.findOne({email});

    if (existedUser) {
      throw new ApiError(
        409,
        'User with this email is already exists!'
      );
    }

    //create a user object - create entry in the database
    const user = await User.create({
      name,
      email,
      phone,
      password,
      role
    });

    const createdUser = await User.findById(user._id).select(
      '-password -refreshToken'
    );

    if (!createdUser) {
      throw new ApiError(
        500,
        'Something went wrong while registering the user!'
      );
    }

    // finally sending response
    return res
      .status(201)
      .json(new ApiResponse(201, createdUser, 'User is created Successfully!'));
  } catch (error) {
    throw error;
  }
});

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {

  const {email, password } = req.body;

  if (!(email && password)) {
    throw new ApiError(400, 'Email and password both are required!');
  }

  const user = await User.findOne({email}).select('+password');

  if (!user) {
    throw new ApiError(404, 'User does not exist!');
  }


  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid user Credentials.');
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  //
  const loggedInUser = await User.findById(user._id).select(
    '-password -refreshToken'
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie('accessToken', accessToken, options)
    .cookie('refreshToken', refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        'User logged In successfully.'
      )
    );
});

// @desc    Log user out / clear cookie
// @route   GET /api/v1/auth/logout
// @access  Private
const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: { refreshToken: 1 },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie('accessToken', options)
    .clearCookie('refreshToken', options)
    .json(new ApiResponse(200, {}, 'User Logged out Successfully.'));
});

// @desc    Get current logged in user
// @route   GET /api/v1/auth/me
// @access  Private
const getUser = asyncHandler(async (req, res) => {
  
  return res.status(200).json(new ApiResponse(200, req.user, "User fetched successfully"))
 
});

// @desc    Update user details
// @route   PUT /api/v1/auth/updatedetails
// @access  Private
const updateAccountDetails = asyncHandler(async (req, res) => {
  const { name, email , phone } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        name,
        email,
        phone
      },
    },
    { 
      new: true, 
      runValidators : true
    }
  ).select('-password');

  return res
    .status(200)
    .json(
      new ApiResponse(200, user, 'User accout details updated successfully.')
    );
});

// @desc    Update password
// @route   PUT /api/v1/auth/updatepassword
// @access  Private
const updatePassword = asyncHandler(async (req, res, next) => {

  const {currentPassword, newPassword} = req.body;
  
  if (currentPassword == newPassword) {
    throw new ApiError(400, 'Old and new password must be different.');
  }

  const user = await User.findById(req.user._id).select('+password');

  // Check current password
  const isPasswordCorrect = await user.isPasswordCorrect(currentPassword);

  if(!isPasswordCorrect) {
    throw new ApiError(404, "Invalid current password")
  }

  user.password = newPassword;
  user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, 'Password updated successfully.'));
});

// Helper function to get token from model, create cookie and send response
// const sendTokenResponse = (user, statusCode, res) => {
//   // Create token
//   const token = user.getSignedJwtToken();

//   const options = {
//     expires: new Date(
//       Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
//     ),
//     httpOnly: true
//   };

//   if (process.env.NODE_ENV === 'production') {
//     options.secure = true;
//   }

//   res
//     .status(statusCode)
//     .cookie('token', token, options)
//     .json({
//       success: true,
//       token
//     });
// };

export {
  registerUser,
  loginUser,
  logoutUser,
  getUser,
  updateAccountDetails,
  updatePassword
};
