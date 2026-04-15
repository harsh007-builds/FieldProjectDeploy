const mongoose = require('mongoose');

const buildingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  ward: {
    type: String,
    required: true
  },
  assignedCleanerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cleaner',
    required: true
  },
  buildingType: {
    type: String,
    enum: ['Residential', 'Commercial'],
    required: true
  },
  status: {
    type: String,
    enum: ['Active', 'Suspended'],
    default: 'Active'
  },
  totalWasteGenerated: {
    type: Number,
    default: 0
  },
  currentGreenScore: {
    type: Number,
    default: 100
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Building', buildingSchema);
