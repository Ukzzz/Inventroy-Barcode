const express = require('express');
const Delivery = require('../models/Delivery');
const Inventory = require('../models/Inventory');
const { requireAuth, requireStaff, requireAdmin } = require('../middleware/auth');
const { flashMessages, getTodayRange, getMonthRange, formatCurrency } = require('../utils/helpers');
const router = express.Router();

// All delivery routes require authentication
router.use(requireAuth);
router.use(flashMessages);

// Delivery scanning page
router.get('/scan', requireStaff, (req, res) => {
  res.render('delivery/scan', {
    title: 'Scan Barcode for Delivery',
    user: req.user
  });
});

// Process barcode scan
router.post('/scan', requireStaff, async (req, res) => {
  try {
    const { barcode } = req.body;
    
    const item = await Inventory.findOne({ barcode });
    if (!item) {
      return res.status(404).json({ 
        success: false, 
        error: 'Item not found with this barcode' 
      });
    }

    if (item.quantity <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Item is out of stock' 
      });
    }

    res.json({
      success: true,
      item: {
        id: item._id,
        itemName: item.itemName,
        category: item.category,
        size: item.size,
        color: item.color,
        barcode: item.barcode,
        quantity: item.quantity,
        price: item.price,
        description: item.description
      }
    });
  } catch (error) {
    console.error('Barcode scan error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error processing barcode scan' 
    });
  }
});

// Record delivery
router.post('/record', requireStaff, async (req, res) => {
  try {
    const { inventoryId, barcode, customerName, quantityDelivered, notes } = req.body;
    
    // Find the inventory item
    const inventoryItem = await Inventory.findById(inventoryId);
    if (!inventoryItem) {
      req.flash('error', 'Inventory item not found');
      return res.redirect('/delivery/scan');
    }

    // Check if enough stock is available
    if (inventoryItem.quantity < parseInt(quantityDelivered)) {
      req.flash('error', `Insufficient stock for ${inventoryItem.itemName}. Available: ${inventoryItem.quantity}, Requested: ${quantityDelivered}`);
      return res.redirect('/delivery/scan');
    }

    // Create delivery record
    const delivery = new Delivery({
      inventoryItem: inventoryId,
      barcode,
      customerName,
      quantityDelivered: parseInt(quantityDelivered),
      deliveredBy: req.session.userId,
      notes
    });

    await delivery.save();

    // Update inventory quantity
    await Inventory.findByIdAndUpdate(inventoryId, {
      $inc: { quantity: -parseInt(quantityDelivered) }
    });

    req.flash('success', `Delivery recorded successfully for ${customerName}`);
    res.redirect('/delivery/scan');
  } catch (error) {
    console.error('Record delivery error:', error);
    req.flash('error', 'Error recording delivery');
    res.redirect('/delivery/scan');
  }
});

// Delivery history
router.get('/history', requireStaff, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (req.query.customerName) {
      filter.customerName = { $regex: req.query.customerName, $options: 'i' };
    }
    if (req.query.startDate && req.query.endDate) {
      filter.deliveryDate = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    }

    const deliveries = await Delivery.find(filter)
      .populate('inventoryItem', 'itemName category size color price')
      .populate('deliveredBy', 'username')
      .sort({ deliveryDate: -1 })
      .skip(skip)
      .limit(limit);

    const totalDeliveries = await Delivery.countDocuments(filter);
    const totalPages = Math.ceil(totalDeliveries / limit);

    res.render('delivery/history', {
      title: 'Delivery History',
      user: req.user,
      deliveries,
      currentPage: page,
      totalPages,
      filter: req.query
    });
  } catch (error) {
    console.error('Delivery history error:', error);
    req.flash('error', 'Error loading delivery history');
    res.redirect('/dashboard');
  }
});

// Get single delivery by ID
router.get('/api/:id', requireStaff, async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id)
      .populate('inventoryItem', 'itemName category size color price')
      .populate('deliveredBy', 'username');

    if (!delivery) {
      return res.status(404).json({ success: false, error: 'Delivery not found' });
    }

    res.json({ success: true, delivery });
  } catch (error) {
    console.error('Get delivery error:', error);
    res.status(500).json({ success: false, error: 'Error fetching delivery details' });
  }
});

// Update delivery (Admin only)
router.post('/update/:id', requireAdmin, async (req, res) => {
  try {
    const { customerName, quantityDelivered, notes } = req.body;
    const delivery = await Delivery.findById(req.params.id);

    if (!delivery) {
      req.flash('error', 'Delivery not found');
      return res.redirect('/delivery/history');
    }

    // If quantity changed, update inventory
    if (parseInt(quantityDelivered) !== delivery.quantityDelivered) {
      const diff = parseInt(quantityDelivered) - delivery.quantityDelivered;
      if (delivery.inventoryItem) {
        const inventoryItem = await Inventory.findById(delivery.inventoryItem);
        if (inventoryItem) {
          // diff < 0 means reducing delivery (returning stock), always allowed
          // diff > 0 means increasing delivery, need to check available stock
          if (diff < 0 || inventoryItem.quantity >= diff) {
            await Inventory.findByIdAndUpdate(delivery.inventoryItem, {
              $inc: { quantity: -diff }
            });
          } else {
            req.flash('error', `Insufficient stock for quantity update. Available: ${inventoryItem.quantity}, Additional needed: ${diff}`);
            return res.redirect('/delivery/history');
          }
        } else {
          req.flash('error', 'Associated inventory item no longer exists');
          return res.redirect('/delivery/history');
        }
      }
    }

    // Update delivery
    delivery.customerName = customerName;
    delivery.quantityDelivered = parseInt(quantityDelivered);
    delivery.notes = notes;
    await delivery.save();

    req.flash('success', 'Delivery updated successfully');
    res.redirect('/delivery/history');
  } catch (error) {
    console.error('Update delivery error:', error);
    req.flash('error', 'Error updating delivery');
    res.redirect('/delivery/history');
  }
});

// Delete delivery (Admin only)
router.post('/delete/:id', requireAdmin, async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id);
    
    if (!delivery) {
      req.flash('error', 'Delivery not found');
      return res.redirect('/delivery/history');
    }

    // If the inventory item still exists, restore the quantity
    if (delivery.inventoryItem) {
      await Inventory.findByIdAndUpdate(delivery.inventoryItem, {
        $inc: { quantity: delivery.quantityDelivered }
      });
    }

    await Delivery.findByIdAndDelete(req.params.id);
    req.flash('success', 'Delivery deleted successfully');
    res.redirect('/delivery/history');
  } catch (error) {
    console.error('Delete delivery error:', error);
    req.flash('error', 'Error deleting delivery');
    res.redirect('/delivery/history');
  }
});

// Get delivery statistics
router.get('/api/stats', requireStaff, async (req, res) => {
  try {
    const { today, tomorrow } = getTodayRange();
    const { thisMonth, nextMonth } = getMonthRange();

    const stats = {
      todayDeliveries: await Delivery.countDocuments({
        deliveryDate: { $gte: today, $lt: tomorrow }
      }),
      thisMonthDeliveries: await Delivery.countDocuments({
        deliveryDate: { $gte: thisMonth, $lt: nextMonth }
      }),
      totalDeliveries: await Delivery.countDocuments(),
      totalItemsDelivered: await Delivery.aggregate([
        { $group: { _id: null, total: { $sum: '$quantityDelivered' } } }
      ]).then(result => result[0]?.total || 0)
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Delivery stats error:', error);
    res.status(500).json({ error: 'Error getting delivery statistics' });
  }
});

module.exports = router;
