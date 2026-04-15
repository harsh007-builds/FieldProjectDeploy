const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Building = require('../models/Building');
const WasteLog = require('../models/WasteLog');
const Complaint = require('../models/Complaint');
const Cleaner = require('../models/Cleaner');
const SystemSettings = require('../models/SystemSettings');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const upload = require('../utils/upload');

// Settings Routes
router.get('/settings', async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({
        wetWastePrice: 5,
        dryWastePrice: 5,
        rejectWastePrice: 15
      });
    }
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const { wetWastePrice, dryWastePrice, rejectWastePrice } = req.body;
    
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({
        wetWastePrice: wetWastePrice || 5,
        dryWastePrice: dryWastePrice || 5,
        rejectWastePrice: rejectWastePrice || 15
      });
    } else {
      settings.wetWastePrice = wetWastePrice ?? settings.wetWastePrice;
      settings.dryWastePrice = dryWastePrice ?? settings.dryWastePrice;
      settings.rejectWastePrice = rejectWastePrice ?? settings.rejectWastePrice;
      await settings.save();
    }
    
    res.json({ message: 'Settings updated successfully', settings });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Cleaner Routes
router.post('/cleaners', async (req, res) => {
  try {
    const { name, phone, assignedWard } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    const cleaner = new Cleaner({
      name,
      phone,
      assignedWard: assignedWard || null
    });

    await cleaner.save();
    res.status(201).json({ message: 'Cleaner registered successfully', cleaner });
  } catch (error) {
    console.error('Error registering cleaner:', error);
    res.status(500).json({ error: 'Failed to register cleaner' });
  }
});

router.get('/cleaners', async (req, res) => {
  try {
    const cleaners = await Cleaner.find().sort({ createdAt: -1 });
    res.json(cleaners);
  } catch (error) {
    console.error('Error fetching cleaners:', error);
    res.status(500).json({ error: 'Failed to fetch cleaners' });
  }
});

router.put('/cleaners/:id/reassign', async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedWard } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid cleaner ID' });
    }

    const cleaner = await Cleaner.findById(id);
    if (!cleaner) {
      return res.status(404).json({ error: 'Cleaner not found' });
    }

    cleaner.assignedWard = assignedWard;
    await cleaner.save();

    res.json({ message: 'Cleaner reassigned successfully', cleaner });
  } catch (error) {
    console.error('Error reassigning cleaner:', error);
    res.status(500).json({ error: 'Failed to reassign cleaner' });
  }
});

// Building Routes
router.post('/buildings', async (req, res) => {
  try {
    const { name, address, ward, assignedCleanerId, buildingType } = req.body;

    const missingFields = [];
    if (!name) missingFields.push('name');
    if (!address) missingFields.push('address');
    if (!ward) missingFields.push('ward');
    if (!assignedCleanerId) missingFields.push('assignedCleanerId');
    if (!buildingType) missingFields.push('buildingType');

    if (missingFields.length > 0) {
      return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
    }

    const validTypes = ['Residential', 'Commercial'];
    if (!validTypes.includes(buildingType)) {
      return res.status(400).json({ error: 'Building type must be Residential or Commercial' });
    }

    if (!mongoose.Types.ObjectId.isValid(assignedCleanerId)) {
      return res.status(400).json({ error: 'Invalid cleaner ID' });
    }

    const cleaner = await Cleaner.findById(assignedCleanerId);
    if (!cleaner) {
      return res.status(400).json({ error: 'Cleaner not found' });
    }

    const building = new Building({
      name,
      address,
      ward,
      assignedCleanerId,
      buildingType,
      status: 'Active',
      totalWasteGenerated: 0,
      currentGreenScore: 100
    });

    await building.save();
    res.status(201).json({ message: 'Building created successfully', building });
  } catch (error) {
    console.error('Error creating building:', error);
    res.status(500).json({ error: 'Failed to create building' });
  }
});

router.put('/buildings/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid building ID' });
    }

    const building = await Building.findById(id);
    if (!building) {
      return res.status(404).json({ error: 'Building not found' });
    }

    building.status = building.status === 'Active' ? 'Suspended' : 'Active';
    await building.save();

    res.json({ message: 'Building status updated', building });
  } catch (error) {
    console.error('Error updating building status:', error);
    res.status(500).json({ error: 'Failed to update building status' });
  }
});

router.post('/logs', upload.single('proofImage'), async (req, res) => {
  try {
    let buildingId, wasteType, weightKg, loggedBy, proofImageUrl;

    if (req.file) {
      buildingId = req.body.buildingId;
      wasteType = req.body.wasteType;
      weightKg = req.body.weightKg;
      loggedBy = req.body.loggedBy;
      proofImageUrl = '/uploads/' + req.file.filename;
    } else {
      buildingId = req.body.buildingId;
      wasteType = req.body.wasteType;
      weightKg = req.body.weightKg;
      loggedBy = req.body.loggedBy;
    }

    if (!buildingId || !wasteType || !weightKg) {
      return res.status(400).json({ error: 'buildingId, wasteType, and weightKg are required' });
    }

    const validWasteTypes = ['Wet', 'Dry', 'Reject'];
    if (!validWasteTypes.includes(wasteType)) {
      return res.status(400).json({ error: 'wasteType must be Wet, Dry, or Reject' });
    }

    const wasteLog = new WasteLog({
      buildingId,
      loggedBy: loggedBy || 'System',
      wasteType,
      weightKg,
      proofImageUrl
    });

    await wasteLog.save();

    await updateGreenScore(buildingId);

    res.status(201).json({ message: 'Waste log created successfully', wasteLog });
  } catch (error) {
    console.error('Error creating waste log:', error);
    res.status(500).json({ error: 'Failed to create waste log' });
  }
});

router.get('/buildings/leaderboard', async (req, res) => {
  try {
    const buildings = await Building.find().sort({ currentGreenScore: -1 });
    res.json(buildings);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

router.get('/buildings/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid building ID' });
    }

    const building = await Building.findById(id);
    if (!building) {
      return res.status(404).json({ error: 'Building not found' });
    }

    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({
        wetWastePrice: 5,
        dryWastePrice: 5,
        rejectWastePrice: 15
      });
    }

    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);

    const aggregation = await WasteLog.aggregate([
      { $match: { buildingId: new mongoose.Types.ObjectId(id), date: { $gte: firstOfMonth } } },
      {
        $group: {
          _id: null,
          totalWet: { $sum: { $cond: [{ $eq: ['$wasteType', 'Wet'] }, '$weightKg', 0] } },
          totalDry: { $sum: { $cond: [{ $eq: ['$wasteType', 'Dry'] }, '$weightKg', 0] } },
          totalReject: { $sum: { $cond: [{ $eq: ['$wasteType', 'Reject'] }, '$weightKg', 0] } }
        }
      }
    ]);

    const totals = aggregation.length > 0 ? aggregation[0] : { totalWet: 0, totalDry: 0, totalReject: 0 };
    const totalWaste = totals.totalWet + totals.totalDry + totals.totalReject;

    const allBuildings = await Building.find().sort({ currentGreenScore: -1 });
    const rank = allBuildings.findIndex(b => b._id.toString() === id) + 1;

    const currentBill = (totals.totalWet * settings.wetWastePrice) + 
                        (totals.totalDry * settings.dryWastePrice) + 
                        (totals.totalReject * settings.rejectWastePrice);
    
    const penaltyAmount = totals.totalReject * (settings.rejectWastePrice - settings.dryWastePrice);

    res.json({
      building: {
        id: building._id,
        name: building.name,
        address: building.address,
        currentGreenScore: building.currentGreenScore,
        totalWasteGenerated: building.totalWasteGenerated
      },
      wasteStats: {
        wetKg: totals.totalWet,
        dryKg: totals.totalDry,
        rejectKg: totals.totalReject,
        totalKg: totalWaste
      },
      rank: {
        position: rank,
        totalBuildings: allBuildings.length
      },
      billing: {
        currentBill: parseFloat(currentBill.toFixed(2)),
        penaltyAmount: parseFloat(penaltyAmount.toFixed(2)),
        rates: {
          wetWastePrice: settings.wetWastePrice,
          dryWastePrice: settings.dryWastePrice,
          rejectWastePrice: settings.rejectWastePrice
        }
      }
    });
  } catch (error) {
    console.error('Error fetching building stats:', error);
    res.status(500).json({ error: 'Failed to fetch building stats' });
  }
});

router.get('/buildings/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const logs = await WasteLog.find({
      buildingId: id,
      date: { $gte: thirtyDaysAgo }
    }).sort({ date: 1 });

    const groupedByDate = {};
    logs.forEach(log => {
      const dateKey = log.date.toISOString().split('T')[0];
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = { Wet: 0, Dry: 0, Reject: 0 };
      }
      groupedByDate[dateKey][log.wasteType] += log.weightKg;
    });

    const history = Object.entries(groupedByDate).map(([date, breakdown]) => ({
      date,
      ...breakdown
    }));

    res.json(history);
  } catch (error) {
    console.error('Error fetching building history:', error);
    res.status(500).json({ error: 'Failed to fetch building history' });
  }
});

router.post('/complaints', async (req, res) => {
  try {
    const { buildingId, description, raisedBy } = req.body;

    if (!buildingId || !description || !raisedBy) {
      return res.status(400).json({ error: 'buildingId, description, and raisedBy are required' });
    }

    const complaint = new Complaint({
      buildingId,
      description,
      raisedBy,
      status: 'Pending'
    });

    await complaint.save();
    res.status(201).json({ message: 'Complaint created successfully', complaint });
  } catch (error) {
    console.error('Error creating complaint:', error);
    res.status(500).json({ error: 'Failed to create complaint' });
  }
});

router.get('/complaints/building/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const complaints = await Complaint.find({ buildingId: id }).sort({ createdAt: -1 });
    res.json(complaints);
  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
});

function calculateCollectionCost(wet, dry, reject) {
  const wetDryRate = 0.10;
  const rejectRate = 0.50;
  return parseFloat(((wet + dry) * wetDryRate + reject * rejectRate).toFixed(2));
}

router.get('/system/stats', async (req, res) => {
  try {
    const buildings = await Building.find();
    const buildingsCount = buildings.length;
    const activeCleaners = await Cleaner.find({ status: 'Active' });
    const totalActiveCleaners = activeCleaners.length;
    
    const totalWaste = buildings.reduce((sum, b) => sum + (b.totalWasteGenerated || 0), 0);
    const avgGreenScore = buildingsCount > 0 
      ? Math.round(buildings.reduce((sum, b) => sum + (b.currentGreenScore || 0), 0) / buildingsCount)
      : 0;

    res.json({
      totalBuildings: buildingsCount,
      totalActiveCleaners,
      systemAverageGreenScore: avgGreenScore,
      totalSystemWaste: totalWaste
    });
  } catch (error) {
    console.error('Error fetching system stats:', error);
    res.status(500).json({ error: 'Failed to fetch system stats' });
  }
});

router.get('/complaints/all', async (req, res) => {
  try {
    const complaints = await Complaint.find()
      .sort({ createdAt: -1 })
      .populate('buildingId', 'name address');
    
    const formatted = complaints.map(c => ({
      _id: c._id,
      buildingName: c.buildingId?.name || 'Unknown',
      buildingAddress: c.buildingId?.address || '',
      description: c.description,
      status: c.status,
      raisedBy: c.raisedBy,
      assignedCleanerId: c.assignedCleanerId,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }));
    
    res.json(formatted);
  } catch (error) {
    console.error('Error fetching all complaints:', error);
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
});

router.put('/complaints/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid complaint ID' });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    if (complaint.status === 'Resolved') {
      return res.status(400).json({ error: 'Complaint already resolved' });
    }

    complaint.status = 'Resolved';
    await complaint.save();

    res.json({ message: 'Complaint resolved successfully', complaint });
  } catch (error) {
    console.error('Error resolving complaint:', error);
    res.status(500).json({ error: 'Failed to resolve complaint' });
  }
});

router.put('/complaints/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { cleanerId } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid complaint ID' });
    }

    if (!cleanerId || !mongoose.Types.ObjectId.isValid(cleanerId)) {
      return res.status(400).json({ error: 'Valid cleanerId is required' });
    }

    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    if (complaint.status === 'Resolved') {
      return res.status(400).json({ error: 'Complaint already resolved' });
    }

    complaint.assignedCleanerId = cleanerId;
    complaint.status = 'Assigned';
    await complaint.save();

    res.json({ message: 'Collector assigned successfully', complaint });
  } catch (error) {
    console.error('Error assigning collector:', error);
    res.status(500).json({ error: 'Failed to assign collector' });
  }
});

async function updateGreenScore(buildingId) {
  const aggregation = await WasteLog.aggregate([
    { $match: { buildingId: new mongoose.Types.ObjectId(buildingId) } },
    {
      $group: {
        _id: null,
        totalWet: { $sum: { $cond: [{ $eq: ['$wasteType', 'Wet'] }, '$weightKg', 0] } },
        totalDry: { $sum: { $cond: [{ $eq: ['$wasteType', 'Dry'] }, '$weightKg', 0] } },
        totalReject: { $sum: { $cond: [{ $eq: ['$wasteType', 'Reject'] }, '$weightKg', 0] } }
      }
    }
  ]);

  if (aggregation.length === 0) return;

  const { totalWet, totalDry, totalReject } = aggregation[0];
  const totalWasteGenerated = totalWet + totalDry + totalReject;

  if (totalWasteGenerated === 0) return;

  const segregationRatio = (totalWet + totalDry) / totalWasteGenerated;
  const rejectPenalty = (totalReject / totalWasteGenerated) * 50;
  let currentGreenScore = Math.round((segregationRatio * 100) - rejectPenalty);
  currentGreenScore = Math.max(0, Math.min(100, currentGreenScore));

  await Building.findByIdAndUpdate(buildingId, {
    totalWasteGenerated,
    currentGreenScore
  });
}

// Reports Routes
router.get('/reports/csv', async (req, res) => {
  try {
    const logs = await WasteLog.find().populate('buildingId', 'name ward');
    
    const data = logs.map(log => ({
      buildingName: log.buildingId?.name || 'Unknown',
      ward: log.buildingId?.ward || 'N/A',
      loggedBy: log.loggedBy,
      date: log.date.toISOString().split('T')[0],
      wasteType: log.wasteType,
      weightKg: log.weightKg
    }));

    const fields = ['buildingName', 'ward', 'loggedBy', 'date', 'wasteType', 'weightKg'];
    const parser = new Parser({ fields });
    const csv = parser.parse(data);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="city_waste_report.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Error generating CSV:', error);
    res.status(500).json({ error: 'Failed to generate CSV report' });
  }
});

router.get('/reports/pdf', async (req, res) => {
  try {
    const buildings = await Building.find().sort({ currentGreenScore: -1 }).limit(3);
    const allBuildings = await Building.find();
    
    const totalWaste = allBuildings.reduce((sum, b) => sum + (b.totalWasteGenerated || 0), 0);
    const avgScore = allBuildings.length > 0 
      ? Math.round(allBuildings.reduce((sum, b) => sum + (b.currentGreenScore || 0), 0) / allBuildings.length)
      : 0;

    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="city_waste_summary.pdf"');
    
    doc.pipe(res);
    
    doc.fontSize(20).text('City Waste Management Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text('System Summary', { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Total Buildings: ${allBuildings.length}`);
    doc.text(`Total System Waste: ${totalWaste} kg`);
    doc.text(`Average Green Score: ${avgScore}%`);
    doc.moveDown();
    doc.fontSize(14).text('Top 3 Performing Buildings', { underline: true });
    doc.moveDown();
    
    buildings.forEach((b, i) => {
      doc.fontSize(12).text(`${i + 1}. ${b.name} - Score: ${b.currentGreenScore}%`);
    });
    
    doc.end();
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
});

// System Alerts Route
router.get('/system/alerts', async (req, res) => {
  try {
    const alerts = [];
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const lowScoreBuildings = await Building.find({ 
      currentGreenScore: { $lt: 30 },
      status: 'Active'
    });

    for (const building of lowScoreBuildings) {
      alerts.push({
        type: 'CRITICAL_SCORE',
        buildingName: building.name,
        score: building.currentGreenScore,
        message: `Green score dropped to ${building.currentGreenScore}%`
      });
    }

    const activeBuildings = await Building.find({ status: 'Active' });
    for (const building of activeBuildings) {
      const recentLog = await WasteLog.findOne({
        buildingId: building._id,
        date: { $gte: threeDaysAgo }
      });

      if (!recentLog) {
        const daysMissed = 3;
        alerts.push({
          type: 'MISSED_COLLECTION',
          buildingName: building.name,
          daysMissed: daysMissed,
          message: 'No waste collection recorded in past 3 days'
        });
      }
    }

    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch system alerts' });
  }
});

module.exports = router;
module.exports.updateGreenScore = updateGreenScore;
