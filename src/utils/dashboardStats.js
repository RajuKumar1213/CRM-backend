import {Lead} from "../models/Lead.models"
import { FollowUp } from "../models/FollowUp.models";
import {Activity} from "../models/Activity.models"
import { User } from "../models/User.models";
import moment from "moment" 

/**
 * Get dashboard statistics for admin view
 * @returns {Promise<Object>} - Dashboard statistics
 */
exports.getAdminDashboardStats = async () => {
  const today = moment().startOf('day');
  const weekStart = moment().startOf('week');
  const monthStart = moment().startOf('month');
  
  try {
    // Get lead statistics
    const [
      totalLeads,
      newLeadsToday,
      newLeadsThisWeek,
      newLeadsThisMonth,
      leadsByStatus,
      conversionRate
    ] = await Promise.all([
      Lead.countDocuments(),
      Lead.countDocuments({ createdAt: { $gte: today.toDate() } }),
      Lead.countDocuments({ createdAt: { $gte: weekStart.toDate() } }),
      Lead.countDocuments({ createdAt: { $gte: monthStart.toDate() } }),
      Lead.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      Lead.aggregate([
        {
          $group: {
            _id: null,            totalLeads: { $sum: 1 },
            closedWon: {
              $sum: {
                $cond: [{ $eq: ['$status', 'won'] }, 1, 0]
              }
            }
          }
        },
        {
          $project: {
            _id: 0,
            conversionRate: {
              $cond: [
                { $eq: ['$totalLeads', 0] },
                0,
                { $multiply: [{ $divide: ['$closedWon', '$totalLeads'] }, 100] }
              ]
            }
          }
        }
      ])
    ]);
    
    // Format lead status for easier consumption
    const leadStatusCounts = {};
    leadsByStatus.forEach(item => {
      leadStatusCounts[item._id] = item.count;
    });
    
    // Get followup statistics
    const [
      pendingFollowUps,
      followUpsDueToday,
      completedFollowUpsToday,
      missedFollowUps
    ] = await Promise.all([
      FollowUp.countDocuments({ status: 'pending' }),
      FollowUp.countDocuments({
        status: 'pending',
        scheduled: { $gte: today.toDate(), $lte: today.clone().endOf('day').toDate() }
      }),
      FollowUp.countDocuments({
        status: 'completed',
        completedAt: { $gte: today.toDate() }
      }),
      FollowUp.countDocuments({
        status: 'missed',
        scheduled: { $lt: today.toDate() }
      })
    ]);
    
    // Get user performance statistics
    const userPerformance = await Activity.aggregate([
      {
        $match: {
          createdAt: { $gte: monthStart.toDate() }
        }
      },
      {
        $group: {
          _id: '$user',
          totalActivities: { $sum: 1 },
          calls: {
            $sum: {
              $cond: [{ $eq: ['$type', 'call'] }, 1, 0]
            }
          },
          whatsapp: {
            $sum: {
              $cond: [{ $eq: ['$type', 'whatsapp'] }, 1, 0]
            }
          },
          emails: {
            $sum: {
              $cond: [{ $eq: ['$type', 'email'] }, 1, 0]
            }
          },
          meetings: {
            $sum: {
              $cond: [{ $eq: ['$type', 'meeting'] }, 1, 0]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          name: '$user.name',
          totalActivities: 1,
          calls: 1,
          whatsapp: 1,
          emails: 1,
          meetings: 1
        }
      },
      {
        $sort: { totalActivities: -1 }
      }
    ]);
    
    return {
      leadStats: {
        totalLeads,
        newLeadsToday,
        newLeadsThisWeek,
        newLeadsThisMonth,
        leadStatusCounts,
        conversionRate: conversionRate.length > 0 ? conversionRate[0].conversionRate.toFixed(2) : 0
      },
      followUpStats: {
        pendingFollowUps,
        followUpsDueToday,
        completedFollowUpsToday,
        missedFollowUps
      },
      userPerformance
    };
  } catch (error) {
    console.error('Error generating dashboard stats:', error);
    throw error;
  }
};

/**
 * Get dashboard statistics for an employee
 * @param {String} userId - The ID of the employee
 * @returns {Promise<Object>} - Dashboard statistics for the employee
 */
exports.getEmployeeDashboardStats = async (userId) => {
  const today = moment().startOf('day');
  const weekStart = moment().startOf('week');
  const monthStart = moment().startOf('month');
  
  try {
    // Get lead statistics for this employee
    const [
      totalLeads,
      leadsByStatus,
      followUpsDueToday,
      pendingFollowUps,
      recentActivities
    ] = await Promise.all([
      Lead.countDocuments({ assignedTo: userId }),
      Lead.aggregate([
        {
          $match: { assignedTo: mongoose.Types.ObjectId(userId) }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      FollowUp.countDocuments({
        assignedTo: userId,
        status: 'pending',
        scheduled: { $gte: today.toDate(), $lte: today.clone().endOf('day').toDate() }
      }),
      FollowUp.countDocuments({
        assignedTo: userId,
        status: 'pending'
      }),
      Activity.find({ user: userId })
        .sort('-createdAt')
        .limit(10)
        .populate('lead')
    ]);
    
    // Format lead status for easier consumption
    const leadStatusCounts = {};
    leadsByStatus.forEach(item => {
      leadStatusCounts[item._id] = item.count;
    });
    
    // Get activity counts by type
    const activityCounts = await Activity.aggregate([
      {
        $match: {
          user: mongoose.Types.ObjectId(userId),
          createdAt: { $gte: monthStart.toDate() }
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Format activity counts
    const activityTypeCounts = {};
    activityCounts.forEach(item => {
      activityTypeCounts[item._id] = item.count;
    });
    
    return {
      leadStats: {
        totalLeads,
        leadStatusCounts
      },
      followUpStats: {
        followUpsDueToday,
        pendingFollowUps
      },
      activityStats: {
        activityTypeCounts,
        recentActivities
      }
    };
  } catch (error) {
    console.error('Error generating employee dashboard stats:', error);
    throw error;
  }
};