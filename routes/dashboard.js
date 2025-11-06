const express = require('express');
const Inventory = require('../models/Inventory');
const Delivery = require('../models/Delivery');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { flashMessages, getTodayRange, getMonthRange, getTotalFromAggregate } = require('../utils/helpers');
const router = express.Router();

router.use(flashMessages);

// All dashboard routes require authentication
router.use(requireAuth);

// Dashboard home page
router.get('/', async (req, res) => {
  try {
    // Get statistics
    const totalItems = await Inventory.countDocuments();
    const totalStock = await Inventory.aggregate([
      { $group: { _id: null, total: { $sum: '$quantity' } } }
    ]).then(result => getTotalFromAggregate(result));

    const lowStockItems = await Inventory.countDocuments({ quantity: { $lte: 10, $gt: 0 } });
    const outOfStockItems = await Inventory.countDocuments({ quantity: 0 });

    // Today's deliveries
    const { today, tomorrow } = getTodayRange();
    const todayDeliveries = await Delivery.countDocuments({
      deliveryDate: { $gte: today, $lt: tomorrow }
    });

    // This month's deliveries
    const { thisMonth, nextMonth } = getMonthRange();
    const thisMonthDeliveries = await Delivery.countDocuments({
      deliveryDate: { $gte: thisMonth, $lt: nextMonth }
    });

    // Recent deliveries
    const recentDeliveries = await Delivery.find()
      .populate('inventoryItem', 'itemName category')
      .populate('deliveredBy', 'username')
      .sort({ deliveryDate: -1 })
      .limit(5);

    // Low stock items
    const lowStockList = await Inventory.find({ quantity: { $lte: 10, $gt: 0 } })
      .sort({ quantity: 1 })
      .limit(5);

    // Category-wise stock
    const categoryStock = await Inventory.aggregate([
      { $group: { _id: '$category', totalQuantity: { $sum: '$quantity' }, itemCount: { $sum: 1 } } },
      { $sort: { totalQuantity: -1 } }
    ]);

    res.render('dashboard/index', {
      title: 'Dashboard',
      user: req.user,
      stats: {
        totalItems,
        totalStock,
        lowStockItems,
        outOfStockItems,
        todayDeliveries,
        thisMonthDeliveries
      },
      recentDeliveries,
      lowStockList,
      categoryStock
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    req.flash('error', 'Error loading dashboard');
    res.render('dashboard/index', {
      title: 'Dashboard',
      user: req.user,
      stats: {},
      recentDeliveries: [],
      lowStockList: [],
      categoryStock: []
    });
  }
});

// Get dashboard statistics (API endpoint)
router.get('/api/stats', async (req, res) => {
  try {
    const { today, tomorrow } = getTodayRange();
    const { thisMonth, nextMonth } = getMonthRange();

    const stats = {
      totalItems: await Inventory.countDocuments(),
      totalStock: await Inventory.aggregate([
        { $group: { _id: null, total: { $sum: '$quantity' } } }
      ]).then(result => getTotalFromAggregate(result)),
      lowStockItems: await Inventory.countDocuments({ quantity: { $lte: 10, $gt: 0 } }),
      outOfStockItems: await Inventory.countDocuments({ quantity: 0 }),
      todayDeliveries: await Delivery.countDocuments({
        deliveryDate: { $gte: today, $lt: tomorrow }
      }),
      thisMonthDeliveries: await Delivery.countDocuments({
        deliveryDate: { $gte: thisMonth, $lt: nextMonth }
      }),
      totalDeliveries: await Delivery.countDocuments()
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Error getting dashboard statistics' });
  }
});

module.exports = router;
