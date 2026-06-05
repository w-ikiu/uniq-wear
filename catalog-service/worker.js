const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  productId: Number,
  userId: Number,
  rating: Number,
  title: String,
  body: String,
  status: { type: String, default: 'pending' }
}, { collection: 'reviews' });

const Review = mongoose.model('Review', ReviewSchema);

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('[worker] MONGO_URI not set');
    process.exit(1);
  }

  console.log('[worker] connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('[worker] connected');

  const stats = await Review.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);

  const total = stats.reduce((sum, s) => sum + s.count, 0);
  console.log(`[worker] review stats (total: ${total}):`);
  for (const s of stats) {
    console.log(`  ${s._id}: ${s.count}`);
  }

  const pending = stats.find(s => s._id === 'pending');
  if (pending && pending.count > 0) {
    console.log(`[worker] ${pending.count} reviews awaiting approval`);
  } else {
    console.log('[worker] no pending reviews');
  }

  await mongoose.disconnect();
  console.log('[worker] done');
}

main().catch(err => {
  console.error('[worker] error:', err.message);
  process.exit(1);
});
