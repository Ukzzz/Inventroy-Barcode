// FULL UPDATED INVENTORY ROUTES WITH EXCELJS BARCODE EXPORT (COMPLETE FILE)

const express = require('express');
const Inventory = require('../models/Inventory');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const bwipjs = require('bwip-js');
const ExcelJS = require('exceljs');
const moment = require('moment');
const { flashMessages } = require('../utils/helpers');
const { Document, Packer, Paragraph, TextRun, Table, TableCell, TableRow, ImageRun, WidthType, AlignmentType, BorderStyle } = require('docx');

const router = express.Router();

router.use(flashMessages);

// Generate unique 12-digit numeric barcode
const generateBarcode = async () => {
  let attempts = 0;
  const maxAttempts = 100;
  while (attempts < maxAttempts) {
    const barcode = [...Array(12)].map(() => Math.floor(Math.random() * 10)).join('');
    const exists = await Inventory.findOne({ barcode }).lean();
    if (!exists) return barcode;
    attempts++;
  }
  throw new Error('Could not generate a unique barcode after 100 attempts.');
};

// Generate barcode PNG buffer
const generateBarcodeImage = async (barcode) => {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text: barcode,
    scale: 3,
    height: 12,
    includetext: false,
  });
};

// All inventory routes require authentication
router.use(requireAuth);

// Inventory list page
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.search) {
      filter.$or = [
        { itemName: { $regex: req.query.search, $options: 'i' } },
        { barcode: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const items = await Inventory.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalItems = await Inventory.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limit);

    res.render('inventory/list', {
      title: 'Inventory Management',
      items,
      currentPage: page,
      totalPages,
      categories: ['T-Shirt', 'Jacket', 'Cap', 'Trousers', 'Uniform'],
      filter: req.query,
      user: req.user,
    });
  } catch (error) {
    console.error('Inventory list error:', error);
    req.flash('error', 'Error loading inventory');
    res.redirect('/dashboard');
  }
});

// Add new item page
router.get('/add', requireAdmin, (req, res) => {
  res.render('inventory/add', {
    title: 'Add New Item',
    categories: ['T-Shirt', 'Jacket', 'Cap', 'Trousers', 'Uniform'],
    user: req.user,
  });
});

// Add new item (create or increment sizes)
router.post('/add', requireAdmin, async (req, res) => {
  try {
    const { itemName, category, sizes, quantities, color, price, description } = req.body;

    const sizeArray = Array.isArray(sizes) ? sizes : [sizes];
    const quantityArray = Array.isArray(quantities) ? quantities.map((q) => parseInt(q)) : [parseInt(quantities)];

    let itemsCreated = 0;
    let itemsUpdated = 0;

    for (let i = 0; i < sizeArray.length; i++) {
      const size = sizeArray[i];
      const qty = quantityArray[i] ?? 0;
      if (!qty) continue;

      const existingItem = await Inventory.findOne({ itemName, category, size, color });
      if (existingItem) {
        existingItem.quantity += qty;
        await existingItem.save();
        itemsUpdated++;
      } else {
        const barcode = await generateBarcode();
        const newItem = new Inventory({
          itemName,
          category,
          size,
          color,
          barcode,
          quantity: qty,
          price: parseFloat(price),
          description,
        });
        await newItem.save();
        itemsCreated++;
      }
    }

    let message = '';
    if (itemsCreated > 0 && itemsUpdated > 0) message = `Added ${itemsCreated} new size(s) and updated ${itemsUpdated} existing size(s) for ${itemName}`;
    else if (itemsCreated > 0) message = `Successfully added ${itemsCreated} size(s) for ${itemName}`;
    else if (itemsUpdated > 0) message = `Updated quantities for ${itemsUpdated} existing size(s) of ${itemName}`;
    else message = 'No items were added (all quantities were 0)';

    req.flash('success', message);
    res.redirect('/inventory');
  } catch (error) {
    console.error('Add item error:', error);
    req.flash('error', 'Error adding item: ' + error.message);
    res.redirect('/inventory/add');
  }
});

// Edit item page
router.get('/edit/:id', requireAdmin, async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) {
      req.flash('error', 'Item not found');
      return res.redirect('/inventory');
    }

    res.render('inventory/edit', {
      title: 'Edit Item',
      item,
      categories: ['T-Shirt', 'Jacket', 'Cap', 'Trousers', 'Uniform'],
      user: req.user,
    });
  } catch (error) {
    console.error('Edit item error:', error);
    req.flash('error', 'Error loading item');
    res.redirect('/inventory');
  }
});

// Edit item (update fields)
router.post('/edit/:id', requireAdmin, async (req, res) => {
  try {
    const { itemName, category, size, color, quantity, price, description } = req.body;
    await Inventory.findByIdAndUpdate(req.params.id, {
      itemName,
      category,
      size,
      color,
      quantity: parseInt(quantity),
      price: parseFloat(price),
      description,
    });

    req.flash('success', 'Item updated successfully');
    res.redirect('/inventory');
  } catch (error) {
    console.error('Update item error:', error);
    req.flash('error', 'Error updating item');
    res.redirect(`/inventory/edit/${req.params.id}`);
  }
});

// Delete item
router.post('/delete/:id', requireAdmin, async (req, res) => {
  try {
    await Inventory.findByIdAndDelete(req.params.id);
    req.flash('success', 'Item deleted successfully');
    res.redirect('/inventory');
  } catch (error) {
    console.error('Delete item error:', error);
    req.flash('error', 'Error deleting item');
    res.redirect('/inventory');
  }
});

// Serve barcode PNG image
router.get('/barcode/:barcode', async (req, res) => {
  try {
    const barcode = (req.params.barcode || '').trim();
    if (!barcode) return res.status(400).send('Missing barcode');

    const png = await generateBarcodeImage(barcode);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', png.length);
    res.send(png);
  } catch (error) {
    console.error('Barcode generation error:', error);
    res.status(500).send('Error generating barcode');
  }
});

// API: Get item by barcode
router.get('/api/barcode/:barcode', async (req, res) => {
  try {
    const barcode = (req.params.barcode || '').replace(/[\r\n]+/g, '').trim();
    const item = await Inventory.findOne({ barcode }).lean();
    if (!item) return res.status(404).json({ success: false, error: 'Item not found' });

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
        description: item.description,
      },
    });
  } catch (error) {
    console.error('API barcode error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update stock quantity
router.post('/update-stock/:id', requireAdmin, async (req, res) => {
  try {
    const { quantity } = req.body;
    await Inventory.findByIdAndUpdate(req.params.id, { quantity: parseInt(quantity) });
    req.flash('success', 'Stock updated successfully');
    res.redirect('/inventory');
  } catch (error) {
    console.error('Update stock error:', error);
    req.flash('error', 'Error updating stock');
    res.redirect('/inventory');
  }
});

// Export all inventory items to Excel WITH REAL BARCODE IMAGES
router.get('/export-all', requireAuth, async (req, res) => {
  try {
    const { category, search } = req.query;

    // Build filter
    const filter = {};
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { itemName: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
      ];
    }

    // Fetch items
    const items = await Inventory.find(filter).sort({ category: 1, itemName: 1 }).lean();

    if (items.length === 0) {
      req.flash('error', 'No inventory items found to export');
      return res.redirect('/inventory');
    }

    // Prepare workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Inventory');

    // Define columns
    sheet.columns = [
      { header: 'Item Name', key: 'itemName', width: 25 },
      { header: 'Category', key: 'category', width: 12 },
      { header: 'Size', key: 'size', width: 10 },
      { header: 'Color', key: 'color', width: 12 },
      { header: 'Barcode Number', key: 'barcodeText', width: 22 },
      { header: 'Barcode Image', key: 'barcodeImg', width: 22 },
      { header: 'Current Stock', key: 'quantity', width: 14 },
      { header: 'Unit Price', key: 'price', width: 12 },
      { header: 'Total Value', key: 'totalValue', width: 14 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Date Added', key: 'dateAdded', width: 20 },
      { header: 'Last Updated', key: 'lastUpdated', width: 20 },
    ];

    // Add rows and embed barcode images
    for (const item of items) {
      const row = sheet.addRow({
        itemName: item.itemName,
        category: item.category,
        size: item.size,
        color: item.color,
        barcodeText: item.barcode,
        quantity: item.quantity,
        price: item.price,
        totalValue: (item.quantity || 0) * (item.price || 0),
        description: item.description || '',
        status: item.quantity === 0 ? 'Out of Stock' : item.quantity <= 10 ? 'Low Stock' : 'In Stock',
        dateAdded: moment(item.createdAt).format('YYYY-MM-DD HH:mm:ss'),
        lastUpdated: moment(item.updatedAt).format('YYYY-MM-DD HH:mm:ss'),
      });

      // Generate barcode PNG and insert
      try {
        const png = await generateBarcodeImage(item.barcode);
        const imageId = workbook.addImage({ buffer: png, extension: 'png' });
        // Image anchored to the "Barcode Image" column (index 5 zero-based)
        sheet.addImage(imageId, {
          tl: { col: 5, row: row.number - 1 },
          br: { col: 6, row: row.number },
          editAs: 'oneCell',
        });
        sheet.getRow(row.number).height = 40; // enough for scan height
      } catch (e) {
        // If any single image generation fails, continue with rest
        console.error('Barcode embed error for', item.barcode, e);
      }
    }

    // Summary
    const totalItems = items.length;
    const totalStock = items.reduce((sum, it) => sum + (it.quantity || 0), 0);
    const totalValue = items.reduce((sum, it) => sum + ((it.quantity || 0) * (it.price || 0)), 0);
    const lowStockItems = items.filter((it) => it.quantity <= 10 && it.quantity > 0).length;
    const outOfStockItems = items.filter((it) => it.quantity === 0).length;

    sheet.addRow({});
    const summaryRow = sheet.addRow({
      itemName: 'SUMMARY',
      quantity: totalStock,
      totalValue: totalValue,
      description: `Total Items: ${totalItems} | Low Stock: ${lowStockItems} | Out of Stock: ${outOfStockItems}`,
    });
    summaryRow.eachCell((cell) => {
      cell.font = { bold: true };
    });

    // Stream workbook to response
    const filename = `inventory-list-${moment().format('YYYY-MM-DD-HHmmss')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Export all inventory error:', error);
    req.flash('error', 'Error exporting inventory list');
    res.redirect('/inventory');
  }
});

// Export barcodes as Word document
router.get('/export-word-barcodes', requireAuth, async (req, res) => {
  try {
    const { category } = req.query;
    const filter = {};
    if (category) {
      filter.category = category;
    }

    const items = await Inventory.find(filter).sort({ category: 1, itemName: 1 });

    if (items.length === 0) {
      req.flash('error', 'No items found to export');
      return res.redirect('/inventory');
    }

    // Create document sections
    const sections = [];

    // Title
    sections.push(
      new Paragraph({
        text: 'Inventory Barcode List',
        heading: 'Heading1',
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      }),
      new Paragraph({
        text: `Generated: ${moment().format('YYYY-MM-DD HH:mm:ss')}`,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    );

    if (category) {
      sections.push(
        new Paragraph({
          text: `Category Filter: ${category}`,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        })
      );
    }

    // Group items by category
    const itemsByCategory = {};
    items.forEach(item => {
      if (!itemsByCategory[item.category]) {
        itemsByCategory[item.category] = [];
      }
      itemsByCategory[item.category].push(item);
    });

    // Process each category
    for (const [cat, catItems] of Object.entries(itemsByCategory)) {
      // Category header
      sections.push(
        new Paragraph({
          text: cat,
          heading: 'Heading2',
          spacing: { before: 400, after: 200 }
        })
      );

      // Create table for this category
      const tableRows = [];

      // Table header
      tableRows.push(
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({
              children: [new Paragraph({ text: 'Barcode Image', bold: true, alignment: AlignmentType.CENTER })],
              width: { size: 35, type: WidthType.PERCENTAGE }
            }),
            new TableCell({
              children: [new Paragraph({ text: 'Item Details', bold: true, alignment: AlignmentType.CENTER })],
              width: { size: 65, type: WidthType.PERCENTAGE }
            })
          ]
        })
      );

      // Process each item
      for (const item of catItems) {
        try {
          // Generate barcode image
          const barcodeBuffer = await generateBarcodeImage(item.barcode);

          // Item details
          const detailsParagraphs = [
            new Paragraph({
              children: [
                new TextRun({ text: 'Item: ', bold: true }),
                new TextRun({ text: item.itemName })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Size: ', bold: true }),
                new TextRun({ text: item.size })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Color: ', bold: true }),
                new TextRun({ text: item.color })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Barcode: ', bold: true }),
                new TextRun({ text: item.barcode })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Stock: ', bold: true }),
                new TextRun({ text: item.quantity.toString() })
              ]
            })
          ];

          // Add row with barcode and details
          tableRows.push(
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new ImageRun({
                          data: barcodeBuffer,
                          transformation: {
                            width: 200,
                            height: 80
                          }
                        })
                      ],
                      alignment: AlignmentType.CENTER
                    })
                  ],
                  verticalAlign: 'center'
                }),
                new TableCell({
                  children: detailsParagraphs
                })
              ]
            })
          );
        } catch (error) {
          console.error(`Error generating barcode for ${item.barcode}:`, error);
          // Add row without image
          tableRows.push(
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: 'Error generating barcode', alignment: AlignmentType.CENTER })]
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'Item: ', bold: true }),
                        new TextRun({ text: item.itemName })
                      ]
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'Barcode: ', bold: true }),
                        new TextRun({ text: item.barcode })
                      ]
                    })
                  ]
                })
              ]
            })
          );
        }
      }

      // Add table to sections
      sections.push(
        new Table({
          rows: tableRows,
          width: {
            size: 100,
            type: WidthType.PERCENTAGE
          },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
            insideVertical: { style: BorderStyle.SINGLE, size: 1 }
          }
        })
      );

      // Add spacing after table
      sections.push(new Paragraph({ text: '', spacing: { after: 400 } }));
    }

    // Create document
    const doc = new Document({
      sections: [{
        properties: {},
        children: sections
      }]
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);

    // Set headers and send
    const filename = `barcodes-${category ? category.toLowerCase() : 'all'}-${moment().format('YYYY-MM-DD')}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    
    res.send(buffer);
  } catch (error) {
    console.error('Export Word barcodes error:', error);
    req.flash('error', 'Error exporting barcodes to Word document');
    res.redirect('/inventory');
  }
});

module.exports = router;
