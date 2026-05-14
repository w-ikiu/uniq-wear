const mongoose = require('mongoose');

// zdarzenie w koszyku (historia akcji uzytkownika)
const cartEventSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['item_added', 'item_removed', 'quantity_changed'],
    required: true
  },
  sku: { type: String, required: true },
  at: { type: Date, default: Date.now }
}, { _id: false });

// pozycja w szkicu koszyka
const cartItemSchema = new mongoose.Schema({
  // referencja do ProductDetails - to umozliwia populate()
  productDetails: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductDetails'
  },
  sku: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 }
}, { _id: false });

const cartDraftSchema = new mongoose.Schema({
  // powiazanie z koszykiem w PostgreSQL
  cartId: { type: Number, required: true, unique: true },
  sessionId: { type: String },
  // tablica zagniezdzona pozycji
  items: [cartItemSchema],
  // historia zdarzen (dla analityki - wymog MongoDB)
  events: [cartEventSchema],
  status: { 
    type: String, 
    enum: ['open', 'closed'],
    default: 'open'
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CartDraft', cartDraftSchema);