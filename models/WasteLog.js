const mongoose = require('mongoose');

const wasteLogSchema = new mongoose.Schema({
  buildingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Building',
    required: true
  },
  loggedBy: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  wasteType: {
    type: String,
    enum: ['Wet', 'Dry', 'Reject'],
    required: true
  },
  weightKg: {
    type: Number,
    required: true
  },
  proofImageUrl: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('WasteLog', wasteLogSchema);