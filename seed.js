const mongoose = require('mongoose');
require('dotenv').config();

const Building = require('./models/Building');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/smart_building_waste';

const seedBuildings = [
  {
    name: 'Apex Towers',
    address: '123 Business District, City Center',
    totalWasteGenerated: 0,
    currentGreenScore: 100
  },
  {
    name: 'Horizon Complex',
    address: '456 Tech Park, Suburban Area',
    totalWasteGenerated: 0,
    currentGreenScore: 100
  },
  {
    name: 'Eco Lofts',
    address: '789 Green Valley, Residential Zone',
    totalWasteGenerated: 0,
    currentGreenScore: 100
  }
];

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    await Building.deleteMany({});
    console.log('Cleared existing Building collection');

    const createdBuildings = await Building.insertMany(seedBuildings);
    console.log(`Created ${createdBuildings.length} dummy buildings:`);
    createdBuildings.forEach(building => {
      console.log(`  - ${building.name} (${building.address})`);
    });

    console.log('Seed completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();