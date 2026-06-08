const CATALOG = '/api/catalog/api'
const CHECKOUT = '/api/checkout/api'

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || err.details || `Błąd ${res.status}`)
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

  getReviews(productId) {
    return request(`${CHECKOUT}/reviews/${productId}`)
  },

  checkout(data) {
    return request(`${CHECKOUT}/checkout`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
}
