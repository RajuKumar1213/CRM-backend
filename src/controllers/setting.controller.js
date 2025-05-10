import mongoose from 'mongoose';
import { CompanySetting } from '../models/CompanySettings.models.js';
import { User } from '../models/User.models.js';
import { Lead } from '../models/Lead.models.js';
import { Activity } from '../models/Activity.models.js';
import { FollowUp } from '../models/FollowUp.models.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Get all company settings
 * @route GET /api/company-settings
 * @access Private/Admin
 */
export const getCompanySettings = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw new ApiError(401, 'Not authorized to view company settings');
  }

  const companySettings = await CompanySetting.find({});

  if (!companySettings || companySettings.length === 0) {
    throw new ApiError(404, 'No company settings found');
  }

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        companySettings,
        'Company settings retrieved successfully'
      )
    );
});

/**
 * Get single company setting by ID
 * @route GET /api/company-settings/:id
 * @access Private/Admin
 */
export const getCompanySettingById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (req.user.role !== 'admin') {
    throw new ApiError(401, 'Not authorized to view company setting');
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid company setting ID');
  }

  const companySetting = await CompanySetting.findById(id);

  if (!companySetting) {
    throw new ApiError(404, 'Company setting not found');
  }

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        companySetting,
        'Company setting retrieved successfully'
      )
    );
});

/**
 * Create new company setting
 * @route POST /api/company-settings
 * @access Private/Admin
 */
export const createCompanySetting = asyncHandler(async (req, res) => {
  const {
    companyName,
    logo,
    contactNumbers,
    whatsappApiProvider,
    whatsappApiUrl,
    leadRotationEnabled,
    numberRotationEnabled,
    autoFollowupEnabled,
    defaultFollowupIntervals,
  } = req.body;

  if (req.user.role !== 'admin') {
    throw new ApiError(401, 'Not authorized to create company setting');
  }

  if (!companyName) {
    throw new ApiError(400, 'Company name is required');
  }

  const companySettingExists = await CompanySetting.findOne({ companyName });
  if (companySettingExists) {
    throw new ApiError(400, 'Company setting with this name already exists');
  }

  const companySetting = await CompanySetting.create({
    companyName,
    logo,
    contactNumbers: contactNumbers || [],
    whatsappApiProvider: whatsappApiProvider || 'twilio',
    whatsappApiUrl,
    leadRotationEnabled: leadRotationEnabled ?? false,
    numberRotationEnabled: numberRotationEnabled ?? false,
    autoFollowupEnabled: autoFollowupEnabled ?? false,
    defaultFollowupIntervals: defaultFollowupIntervals || [],
  });

  if (!companySetting) {
    throw new ApiError(
      400,
      'Failed to create company setting due to invalid data'
    );
  }

  res
    .status(201)
    .json(
      new ApiResponse(
        201,
        companySetting,
        'Company setting created successfully'
      )
    );
});

/**
 * Update company setting
 * @route PUT /api/company-settings/:id
 * @access Private/Admin
 */
export const updateCompanySetting = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (req.user.role !== 'admin') {
    throw new ApiError(401, 'Not authorized to update company setting');
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid company setting ID');
  }

  const companySetting = await CompanySetting.findById(id);
  if (!companySetting) {
    throw new ApiError(404, 'Company setting not found');
  }

  if (!req.body || Object.keys(req.body).length === 0) {
    throw new ApiError(400, 'No update data provided');
  }

  const updatedCompanySetting = await CompanySetting.findByIdAndUpdate(
    id,
    { $set: req.body },
    { new: true, runValidators: true }
  );

  if (!updatedCompanySetting) {
    throw new ApiError(500, 'Failed to update company setting');
  }

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedCompanySetting,
        'Company setting updated successfully'
      )
    );
});

/**
 * Delete company setting
 * @route DELETE /api/company-settings/:id
 * @access Private/Admin
 */
export const deleteCompanySetting = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (req.user.role !== 'admin') {
    throw new ApiError(401, 'Not authorized to delete company setting');
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid company setting ID');
  }

  const companySetting = await CompanySetting.findById(id);
  if (!companySetting) {
    throw new ApiError(404, 'Company setting not found');
  }

  await CompanySetting.findByIdAndDelete(id);

  res
    .status(200)
    .json(new ApiResponse(200, {}, 'Company setting deleted successfully'));
});

/**
 * Get default company setting
 * @route GET /api/company-settings/default
 * @access Private/Admin
 */
export const getDefaultCompanySetting = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw new ApiError(401, 'Not authorized to view default company setting');
  }

  const companySetting = await CompanySetting.findOne().sort({ createdAt: 1 });

  if (!companySetting) {
    throw new ApiError(404, 'No company settings found');
  }

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        companySetting,
        'Default company setting retrieved successfully'
      )
    );
});

/**
 * Get admin dashboard statistics
 * @route GET /api/settings/admin-dashboard-stats
 * @access Private/Admin
 */
export const getAdminDashboardStats = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw new ApiError(401, 'Not authorized to view admin dashboard statistics');
  }
  
  // Get time period from query params (default to 'month')
  const timePeriod = req.query.timePeriod || 'month';
  
  // Create date ranges for statistics
  const today = new Date();
  const startOfToday = new Date(today.setHours(0, 0, 0, 0));
  const endOfToday = new Date(today.setHours(23, 59, 59, 999));
  
  // Get the start of this week (Sunday)
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  // Get the start of last week
  const startOfLastWeek = new Date(startOfWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
  
  // Get the start of this month
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  // Get the start of last month
  const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
  
  // Get the start of this year
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  
  // Get the start of last year
  const startOfLastYear = new Date(today.getFullYear() - 1, 0, 1);
  const endOfLastYear = new Date(today.getFullYear(), 0, 0, 23, 59, 59, 999);
  
  // Gather all statistics in parallel
  const [
    totalLeads,
    newLeadsToday,
    newLeadsThisWeek,
    newLeadsLastWeek,
    newLeadsThisMonth,
    newLeadsLastMonth,
    newLeadsThisYear,
    newLeadsLastYear,
    totalUsers,
    leadStatusCounts,
    leadsBySource,
    recentActivities,
    upcomingFollowUps,
    overdueFollowUps
  ] = await Promise.all([
    // Total leads
    Lead.countDocuments(),
    
    // New leads today
    Lead.countDocuments({
      createdAt: { $gte: startOfToday, $lte: endOfToday }
    }),
    
    // New leads this week
    Lead.countDocuments({
      createdAt: { $gte: startOfWeek }
    }),
    
    // New leads last week
    Lead.countDocuments({
      createdAt: { $gte: startOfLastWeek, $lt: startOfWeek }
    }),
    
    // New leads this month
    Lead.countDocuments({
      createdAt: { $gte: startOfMonth }
    }),
    
    // New leads last month
    Lead.countDocuments({
      createdAt: { $gte: startOfLastMonth, $lt: startOfMonth }
    }),
    
    // Additional data for year period if needed
    Lead.countDocuments({
      createdAt: { $gte: startOfYear }
    }),
    
    Lead.countDocuments({
      createdAt: { $gte: startOfLastYear, $lt: startOfYear }
    }),
    
    // Total users
    User.countDocuments(),
    
    // Lead status counts
    Lead.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]),
    
    // Leads by source
    Lead.aggregate([
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 }
        }
      }    ]),
    
    // Recent activities (limit to 10)
    Activity.find(
      timePeriod === 'today' 
        ? { createdAt: { $gte: startOfToday, $lte: endOfToday } }
        : timePeriod === 'week'
        ? { createdAt: { $gte: startOfWeek, $lte: endOfToday } }
        : timePeriod === 'month'
        ? { createdAt: { $gte: startOfMonth, $lte: endOfToday } }
        : timePeriod === 'year'
        ? { createdAt: { $gte: startOfYear, $lte: endOfToday } }
        : {}
    )
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'name email')
      .populate('lead', 'name phone status')
      .lean(),
    
    // Upcoming follow-ups
    FollowUp.find({
      scheduled: { $gt: new Date() },
      status: 'pending'
    })
      .sort({ scheduled: 1 })
      .limit(5)
      .populate('assignedTo', 'name email')
      .populate('lead', 'name phone status')
      .lean(),
    
    // Overdue follow-ups
    FollowUp.find({
      scheduled: { $lt: new Date() },
      status: 'pending'
    })
      .sort({ scheduled: 1 })
      .limit(5)
      .populate('assignedTo', 'name email')
      .populate('lead', 'name phone status')
      .lean()
  ]);
  
  // Process lead status counts into an object
  const leadStatuses = {};
  leadStatusCounts.forEach(status => {
    leadStatuses[status._id] = status.count;
  });
  
  // Process lead sources into an object
  const sources = {};
  leadsBySource.forEach(source => {
    sources[source._id] = source.count;
  });
  
  // Calculate growth rates for different time periods
  const leadGrowthDaily = 0; // Would need yesterday data to calculate
  
  const leadGrowthWeekly = newLeadsLastWeek > 0 
    ? Math.round(((newLeadsThisWeek - newLeadsLastWeek) / newLeadsLastWeek) * 100) 
    : 0;
  
  const leadGrowthMonthly = newLeadsLastMonth > 0 
    ? Math.round(((newLeadsThisMonth - newLeadsLastMonth) / newLeadsLastMonth) * 100) 
    : 0;
  
  const leadGrowthYearly = newLeadsLastYear > 0 
    ? Math.round(((newLeadsThisYear - newLeadsLastYear) / newLeadsLastYear) * 100) 
    : 0;
  
  // Format recent activities for dashboard
  const formattedActivities = recentActivities.map(activity => {
    return {
      _id: activity._id,
      type: activity.type,
      status: activity.status,
      user: activity.user ? {
        _id: activity.user._id,
        name: activity.user.name
      } : null,
      lead: activity.lead ? {
        _id: activity.lead._id,
        name: activity.lead.name
      } : null,
      createdAt: activity.createdAt,
      timeAgo: getTimeAgo(activity.createdAt)
    };
  });
  
  // Create statistics object
  const dashboardStats = {
    leads: {
      total: totalLeads,
      today: newLeadsToday,
      thisWeek: newLeadsThisWeek,
      lastWeek: newLeadsLastWeek,
      thisMonth: newLeadsThisMonth,
      lastMonth: newLeadsLastMonth,
      thisYear: newLeadsThisYear,
      lastYear: newLeadsLastYear,
      dailyGrowth: leadGrowthDaily,
      weeklyGrowth: leadGrowthWeekly,
      monthlyGrowth: leadGrowthMonthly,
      yearlyGrowth: leadGrowthYearly,
      byStatus: leadStatuses,
      bySource: sources
    },
    users: {
      total: totalUsers
    },
    activities: {
      recent: formattedActivities
    },
    followUps: {
      upcoming: upcomingFollowUps,
      overdue: overdueFollowUps
    }
  };
  
  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        dashboardStats,
        'Admin dashboard statistics retrieved successfully'
      )
    );
});

/**
 * Get user performance statistics
 * @route GET /api/settings/user-performance
 * @access Private/Admin
 */
export const getUserPerformance = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw new ApiError(401, 'Not authorized to view user performance statistics');
  }
  
  // Get date range parameters from request or use defaults
  const { startDate, endDate } = req.query;
  const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
  const end = endDate ? new Date(endDate) : new Date();
  
  // Ensure end date is set to end of day
  end.setHours(23, 59, 59, 999);
  
  // Get all users
  const users = await User.find({ role: 'employee' }).select('name email');
  
  // Get performance data for each user
  const userPerformance = await Promise.all(
    users.map(async (user) => {
      // Get lead counts
      const [
        totalLeads,
        newLeads,
        qualifiedLeads,
        closedWonLeads,
        totalActivities,
        callActivities,
        completedFollowUps
      ] = await Promise.all([
        // Total leads assigned to user
        Lead.countDocuments({ assignedTo: user._id }),
        
        // New leads assigned in date range
        Lead.countDocuments({
          assignedTo: user._id,
          createdAt: { $gte: start, $lte: end }
        }),
        
        // Qualified leads in date range
        Lead.countDocuments({
          assignedTo: user._id,
          status: 'qualified',
          updatedAt: { $gte: start, $lte: end }
        }),
        
        // Closed-won leads in date range
        Lead.countDocuments({
          assignedTo: user._id,
          status: 'closed-won',
          updatedAt: { $gte: start, $lte: end }
        }),
        
        // Total activities in date range
        Activity.countDocuments({
          user: user._id,
          createdAt: { $gte: start, $lte: end }
        }),
        
        // Call activities in date range
        Activity.countDocuments({
          user: user._id,
          type: 'call',
          createdAt: { $gte: start, $lte: end }
        }),
        
        // Completed follow-ups in date range
        FollowUp.countDocuments({
          assignedTo: user._id,
          status: 'completed',
          updatedAt: { $gte: start, $lte: end }
        })
      ]);
      
      // Calculate conversion rate
      const conversionRate = newLeads > 0 ? Math.round((closedWonLeads / newLeads) * 100) : 0;
      
      // Calculate activity per lead
      const activityPerLead = totalLeads > 0 ? (totalActivities / totalLeads).toFixed(1) : 0;
      
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        stats: {
          totalLeads,
          newLeads,
          qualifiedLeads,
          closedWonLeads,
          totalActivities,
          callActivities,
          completedFollowUps,
          conversionRate,
          activityPerLead
        }
      };
    })
  );
  
  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        userPerformance,
        'User performance statistics retrieved successfully'
      )
    );
});

/**
 * Get company health metrics
 * @route GET /api/settings/company-health
 * @access Private/Admin
 */
export const getCompanyHealth = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw new ApiError(401, 'Not authorized to view company health metrics');
  }
  
  // Get the current date and calculate date ranges
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  // Create an array of the last 6 months
  const last6Months = [];
  for (let i = 0; i < 6; i++) {
    const month = currentMonth - i;
    const year = currentYear + Math.floor(month / 12);
    const adjustedMonth = ((month % 12) + 12) % 12; // Handle negative months
    
    const startOfMonth = new Date(year, adjustedMonth, 1);
    const endOfMonth = new Date(year, adjustedMonth + 1, 0, 23, 59, 59, 999);
    
    last6Months.push({
      month: startOfMonth.toLocaleString('default', { month: 'short' }),
      year: year,
      startDate: startOfMonth,
      endDate: endOfMonth
    });
  }
  
  // Reverse the array to get chronological order
  last6Months.reverse();
  
  // Get lead count by month
  const leadsPerMonth = await Promise.all(
    last6Months.map(async (monthData) => {
      const leadCount = await Lead.countDocuments({
        createdAt: {
          $gte: monthData.startDate,
          $lte: monthData.endDate
        }
      });
      
      return {
        month: monthData.month,
        year: monthData.year,
        leadCount
      };
    })
  );
  
  // Get closed-won leads per month for revenue estimation
  const closedWonPerMonth = await Promise.all(
    last6Months.map(async (monthData) => {
      const closedWonCount = await Lead.countDocuments({
        status: 'closed-won',
        updatedAt: {
          $gte: monthData.startDate,
          $lte: monthData.endDate
        }
      });
      
      return {
        month: monthData.month,
        year: monthData.year,
        closedWonCount
      };
    })
  );
  
  // Get recent lead conversions (closed-won in last 30 days)
  const recentConversions = await Lead.find({
    status: 'closed-won',
    updatedAt: {
      $gte: new Date(currentDate.setDate(currentDate.getDate() - 30))
    }
  })
    .populate('assignedTo', 'name')
    .select('name phone product assignedTo createdAt updatedAt')
    .limit(10)
    .lean();
  
  // Calculate conversion time (days from creation to closed-won)
  const conversions = recentConversions.map(lead => {
    const creationDate = new Date(lead.createdAt);
    const conversionDate = new Date(lead.updatedAt);
    const daysDifference = Math.round((conversionDate - creationDate) / (1000 * 60 * 60 * 24));
    
    return {
      ...lead,
      conversionTime: daysDifference
    };
  });
  
  // Calculate average conversion time
  const totalConversionDays = conversions.reduce((total, lead) => total + lead.conversionTime, 0);
  const averageConversionTime = conversions.length > 0 ? Math.round(totalConversionDays / conversions.length) : 0;
  
  const companyHealth = {
    leadsOverTime: leadsPerMonth,
    conversionsOverTime: closedWonPerMonth,
    recentConversions: conversions,
    averageConversionTime,
    monthlyTrends: last6Months.map((monthData, index) => {
      return {
        month: monthData.month,
        year: monthData.year,
        leads: leadsPerMonth[index].leadCount,
        conversions: closedWonPerMonth[index].closedWonCount
      };
    })
  };
  
  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        companyHealth,
        'Company health metrics retrieved successfully'
      )
    );
});

// Helper function to calculate time ago
const getTimeAgo = (date) => {
  const now = new Date();
  const diffMs = now - new Date(date);
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) {
    return diffDays + " day(s) ago";
  } else if (diffHours > 0) {
    return diffHours + " hour(s) ago";
  } else if (diffMins > 0) {
    return diffMins + " minute(s) ago";
  } else {
    return "just now";
  }
};
