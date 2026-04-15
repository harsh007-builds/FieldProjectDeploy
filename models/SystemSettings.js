const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
  wetWastePrice: {
    type: Number,
    default: 5
  },
  dryWastePrice: {
    type: Number,
    default: 5
  },
  rejectWastePrice: {
    type: Number,
    default: 15
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
