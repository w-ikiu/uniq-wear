const mongoose = require('mongoose');

// funkcja laczaca z mongodb przez mongoose
const connectMongo = async () => {
  try {
    // pobieramy uri ze zmiennych srodowiskowych
    await mongoose.connect(process.env.MONGO_URI);
    console.log('polaczono z mongodb (mongoose)');
  } catch (error) {
    console.error('blad polaczenia z mongodb:', error);
    process.exit(1);
  }
};

module.exports = connectMongo;