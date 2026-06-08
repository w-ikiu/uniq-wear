import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { CartProvider } from './CartContext'
import Header from './components/Header'
import CartDrawer from './components/CartDrawer'
import HomePage from './pages/HomePage'
import ProductsPage from './pages/ProductsPage'
import ProductDetailPage from './pages/ProductDetailPage'
import CheckoutPage from './pages/CheckoutPage'
import OrderSuccessPage from './pages/OrderSuccessPage'

export default function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-cream-50">
          <Header />
          <CartDrawer />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/:id" element={<ProductDetailPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order-success" element={<OrderSuccessPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </CartProvider>
  )
}
