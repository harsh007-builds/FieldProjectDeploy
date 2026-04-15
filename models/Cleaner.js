const mongoose = require('mongoose');

const cleanerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  assignedWard: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Cleaner', cleanerSchema);
