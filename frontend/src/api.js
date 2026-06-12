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

  getReviews(productId) {
    return request(`${CHECKOUT}/reviews/${productId}`)
  },

  // wymaga roli admin
  approveReview(reviewId) {
    return request(`${CATALOG}/reviews/${reviewId}/approve`, {
      method: 'PATCH',
    })
  },

  checkout(data) {
    return request(`${CHECKOUT}/checkout`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // wymaga tokenu (dowolna rola)
  getOrders(userId) {
    const qs = userId ? `?userId=${userId}` : ''
    return request(`${CHECKOUT}/orders${qs}`)
  },

  getInventoryStats() {
    return request(`${CATALOG}/stats/inventory`)
  },
}
