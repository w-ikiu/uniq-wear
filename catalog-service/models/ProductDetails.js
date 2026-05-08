const mongoose = require('mongoose');

const productDetailsSchema = new mongoose.Schema({
  productId: { type: Number, required: true, unique: true },
  long_description: { type: String, required: true },
  specs: { type: Map, of: String },
  gallery: [{ url: String, altText: String }] 
});

productDetailsSchema.statics.findByProductId = function(pid) {
  return this.findOne({ productId: pid });
};

module.exports = mongoose.model('ProductDetails', productDetailsSchema);