const express = require('express');
const Delivery = require('../models/Delivery');
const Inventory = require('../models/Inventory');
const { requireAuth, requireStaff } = require('../middleware/auth');
const XLSX = require('xlsx');
const moment = require('moment');
const { flashMessages, formatDateRange, filterValidPopulated, formatCurrency } = require('../utils/helpers');
const router = express.Router();

router.use(flashMessages);

// All report routes require authentication
router.use(requireAuth);

// Reports page
router.get('/', requireStaff, (req, res) => {
  res.render('reports/index', {
    title: 'Generate Reports',
    user: req.user || { username: req.session.username, role: req.session.userRole }
  });
});

// Generate delivery report (Excel)
router.get('/delivery/excel', requireStaff, async (req, res) => {
  try {
    const { startDate, endDate, customerName } = req.query;
    
    // Build filter
    const filter = {};
    if (startDate && endDate) {
      filter.deliveryDate = formatDateRange(startDate, endDate);
    }
    if (customerName) {
      filter.customerName = { $regex: customerName, $options: 'i' };
    }

    // Get deliveries with populated data
    const deliveries = await Delivery.find(filter)
      .populate('inventoryItem', 'itemName category size color price')
      .populate('deliveredBy', 'username')
      .sort({ deliveryDate: -1 });

    // Filter out deliveries with missing references
    const validDeliveries = filterValidPopulated(deliveries, ['inventoryItem', 'deliveredBy']);

    if (validDeliveries.length === 0) {
      req.flash('error', 'No delivery records found for the selected criteria');
      return res.redirect('/reports');
    }

    // Prepare data for Excel
    const excelData = validDeliveries.map(delivery => ({
      'Delivery Date': moment(delivery.deliveryDate).format('YYYY-MM-DD'),
      'Customer Name': delivery.customerName,
      'Item Name': delivery.inventoryItem.itemName,
      'Category': delivery.inventoryItem.category,
      'Size': delivery.inventoryItem.size,
      'Color': delivery.inventoryItem.color,
      'Barcode': delivery.barcode,
      'Quantity Delivered': delivery.quantityDelivered,
      'Unit Price': `Rs ${formatCurrency(delivery.inventoryItem.price)}`,
      'Total Amount': `Rs ${formatCurrency(delivery.quantityDelivered * delivery.inventoryItem.price)}`,
      'Delivered By': delivery.deliveredBy.username,
      'Notes': delivery.notes || ''
    }));

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    const colWidths = [
      { wch: 15 }, // Delivery Date
      { wch: 20 }, // Customer Name
      { wch: 25 }, // Item Name
      { wch: 12 }, // Category
      { wch: 10 }, // Size
      { wch: 15 }, // Color
      { wch: 18 }, // Barcode
      { wch: 18 }, // Quantity Delivered
      { wch: 12 }, // Unit Price
      { wch: 15 }, // Total Amount
      { wch: 15 }, // Delivered By
      { wch: 30 }  // Notes
    ];
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Delivery Report');

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Set response headers
    const filename = `delivery-report-${moment().format('YYYY-MM-DD')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.send(buffer);
  } catch (error) {
    console.error('Excel report error:', error);
    req.flash('error', 'Error generating Excel report');
    res.redirect('/reports');
  }
});

// Generate inventory report (Excel)
router.get('/inventory/excel', requireStaff, async (req, res) => {
  try {
    const { category, lowStock } = req.query;
    
    // Build filter
    const filter = {};
    if (category) filter.category = category;
    if (lowStock === 'true') filter.quantity = { $lte: 10 };

    // Get inventory items
    const items = await Inventory.find(filter).sort({ category: 1, itemName: 1 });

    // Prepare data for Excel
    const excelData = items.map(item => ({
      'Item Name': item.itemName,
      'Category': item.category,
      'Size': item.size,
      'Color': item.color,
      'Barcode': item.barcode,
      'Current Stock': item.quantity,
      'Unit Price': `Rs ${formatCurrency(item.price)}`,
      'Total Value': `Rs ${formatCurrency(item.quantity * item.price)}`,
      'Description': item.description || '',
      'Status': item.quantity <= 10 ? 'Low Stock' : item.quantity === 0 ? 'Out of Stock' : 'In Stock'
    }));

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    const colWidths = [
      { wch: 25 }, // Item Name
      { wch: 12 }, // Category
      { wch: 10 }, // Size
      { wch: 15 }, // Color
      { wch: 18 }, // Barcode
      { wch: 15 }, // Current Stock
      { wch: 12 }, // Unit Price
      { wch: 15 }, // Total Value
      { wch: 30 }, // Description
      { wch: 12 }  // Status
    ];
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory Report');

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Set response headers
    const filename = `inventory-report-${moment().format('YYYY-MM-DD')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.send(buffer);
  } catch (error) {
    console.error('Inventory Excel report error:', error);
    req.flash('error', 'Error generating inventory Excel report');
    res.redirect('/reports');
  }
});

module.exports = router;
