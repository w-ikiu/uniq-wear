import { getToken } from './KeycloakContext'

const CATALOG  = '/api/catalog/api'
const CHECKOUT = '/api/checkout/api'

async function request(url, options = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }

  // dolaczamy token do kazdego zadania jesli uzytkownik jest zalogowany
  // gateway przepusci zadanie bez tokenu tylko dla publicznych sciezek (GET produktow, kategorie)
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(url, { headers, ...options })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || err.details || `Blad ${res.status}`)
  }
  return res.json()
}

export const api = {
  // produkty
  getProducts(params = {}) {
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null)
    )
    const qs = new URLSearchParams(clean).toString()
    return request(`${CATALOG}/products${qs ? `?${qs}` : ''}`)
  },

  getProduct(id) {
    return request(`${CATALOG}/products/${id}`)
  },

  // wymaga roli admin — tworzy produkt w postgres i mongodb jednoczesnie (hybrydowy zapis)
  createProductHybrid({ name, description, categoryId, price, sku, longDescription, stock }) {
    return request(`${CATALOG}/products/hybrid`, {
      method: 'POST',
      body: JSON.stringify({ name, description, categoryId, price, sku, longDescription, stock }),
    })
  },

  // wyszukiwanie szczegolów produktow w mongodb (t5: operatory $text, $gte)
  searchProductDetails(keyword, minWeight) {
    const qs = new URLSearchParams()
    if (keyword)   qs.set('keyword', keyword)
    if (minWeight) qs.set('minWeight', minWeight)
    return request(`${CATALOG}/products/details/search?${qs}`)
  },

  // kategorie
  getCategories() {
    return request(`${CATALOG}/categories`)
  },

  // wymaga roli admin
  createCategory(name) {
    return request(`${CATALOG}/categories`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
  },

  // recenzje
  getReviews(productId) {
    return request(`${CHECKOUT}/reviews/${productId}`)
  },

  // pobiera wszystkie recenzje z opcjonalnym filtrem statusu — dla admina
  getAllReviews(status) {
    const qs = status ? `?status=${status}` : ''
    return request(`${CATALOG}/reviews${qs}`)
  },

  // dodaje recenzje produktu — status pending, wymaga zatwierdzenia przez admina
  submitReview({ productId, userId, rating, title, body }) {
    return request(`${CATALOG}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ productId, userId, rating, title, body, status: 'pending' }),
    })
  },

  // wymaga roli admin
  approveReview(reviewId) {
    return request(`${CATALOG}/reviews/${reviewId}/approve`, {
      method: 'PATCH',
    })
  },

  // analityki
  getAnalyticsRatings() {
    return request(`${CATALOG}/analytics/ratings`)
  },

  getInventoryStats() {
    return request(`${CATALOG}/stats/inventory`)
  },

  // zamowienia
  checkout({ items, userId }) {
    return request(`${CHECKOUT}/checkout`, {
      method: 'POST',
      body: JSON.stringify({ items, userId }),
    })
  },

  getOrders(userId) {
    const qs = userId ? `?userId=${userId}` : ''
    return request(`${CHECKOUT}/orders${qs}`)
  },

  cancelOrder(orderId) {
    return request(`${CHECKOUT}/orders/${orderId}/cancel`, {
      method: 'POST',
    })
  },
}
