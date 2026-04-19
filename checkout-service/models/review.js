const mongoose = require('mongoose');

// wymog t6: subdokument (historia moderacji)
const moderationSchema = new mongoose.Schema({
  status: { type: String, enum: ['pending', 'approved', 'rejected'] },
  changedAt: { type: Date, default: Date.now },
  reason: String
}, { _id: false });

const reviewSchema = new mongoose.Schema({
  productId: { type: Number, required: true },
  userId: { type: Number, required: true },
  rating: {
    type: Number,
    required: true,
    // wymog t6: walidator niestandardowy
    validate: {
      validator: Number.isInteger,
      message: 'ocena musi byc liczba calkowita'
    },
    min: 1,
    max: 5
  },
  title: String,
  body: String,
  // wymog t6: tablica zagniezdona subdokumentow
  moderationHistory: [moderationSchema] 
});

// wymog t6: pre hook (ustawienie domyslnej historii przy tworzeniu)
reviewSchema.pre('save', function(next) {
  if (this.isNew && this.moderationHistory.length === 0) {
    this.moderationHistory.push({ status: 'pending', reason: 'auto-created' });
  }
  next();
});

// wymog t6: statics (metoda statyczna do pobierania zatwierdzonych)
reviewSchema.statics.findApproved = function(productId) {
  return this.find({ 
    productId, 
    'moderationHistory.status': 'approved' 
  });
};

module.exports = mongoose.model('Review', reviewSchema);