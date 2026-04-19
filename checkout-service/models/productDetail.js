const mongoose = require('mongoose');

const productDetailSchema = new mongoose.Schema({
  productId: { type: Number, required: true, unique: true },
  longDescription: {
    type: String,
    // wymog t6: walidator niestandardowy (minimum slow)
    validate: {
      validator: function(v) {
        return v.split(' ').length >= 5;
      },
      message: 'opis musi miec co najmniej 5 slow'
    }
  },
  // elastyczne atrybuty (np. material, waga)
  specs: {
    type: Map,
    of: String
  },
  gallery: [String] // tablica linkow do zdjec
});

// wymog t6: methods (metoda na instancji)
productDetailSchema.methods.getShortSummary = function() {
  if (!this.longDescription) return '';
  return this.longDescription.substring(0, 50) + '...';
};

module.exports = mongoose.model('ProductDetail', productDetailSchema);