const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  productId: { type: Number, required: true },
  userId: { type: Number, required: true },
  rating: {
    type: Number,
    required: true,
    validate: {
      validator: function(v) { return v >= 1 && v <= 5; },
      message: 'ocena musi byc w przedziale od 1 do 5'
    }
  },
  title: { type: String, required: true },
  body: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

reviewSchema.pre('save', function() {
  const badWords = ['cholera', 'kurcze'];
  const hasBadWords = badWords.some(word => 
    this.body.toLowerCase().includes(word) || this.title.toLowerCase().includes(word)
  );

  if (hasBadWords) {
    this.status = 'rejected';
  }
});

module.exports = mongoose.model('Review', reviewSchema);