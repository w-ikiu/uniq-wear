import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { CartProvider } from './CartContext'
import { KeycloakProvider } from './KeycloakContext'
import Header from './components/Header'
import CartDrawer from './components/CartDrawer'
import HomePage from './pages/HomePage'
import ProductsPage from './pages/ProductsPage'
import ProductDetailPage from './pages/ProductDetailPage'
import CheckoutPage from './pages/CheckoutPage'
import OrderSuccessPage from './pages/OrderSuccessPage'
import AdminPage from './pages/AdminPage'

export default function App() {
  return (
    // keycloakprovider musi byc na zewnatrz browserouter — inicjalizuje keycloaka przed renderem tras
    <KeycloakProvider>
      <CartProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-cream-50">
            <Header />
            <CartDrawer />
            <Routes>
              <Route path="/"              element={<HomePage />} />
              <Route path="/products"      element={<ProductsPage />} />
              <Route path="/products/:id"  element={<ProductDetailPage />} />
              <Route path="/checkout"      element={<CheckoutPage />} />
              <Route path="/order-success" element={<OrderSuccessPage />} />
              {/* trasa /admin dostepna dla wszystkich — sama strona sprawdza role */}
              <Route path="/admin"         element={<AdminPage />} />
            </Routes>
          </div>
        </BrowserRouter>
      </CartProvider>
    </KeycloakProvider>
  )
}
