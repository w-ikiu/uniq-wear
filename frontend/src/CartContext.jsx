import { createContext, useContext, useReducer, useEffect } from 'react'

const CartContext = createContext(null)
const STORAGE_KEY = 'uniqwear_cart_v1'

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD': {
      const existing = state.items.find(i => i.sku === action.item.sku)
      const items = existing
        ? state.items.map(i =>
            i.sku === action.item.sku
              ? { ...i, quantity: i.quantity + (action.item.quantity ?? 1) }
              : i
          )
        : [...state.items, { ...action.item, quantity: action.item.quantity ?? 1 }]
      return { ...state, items }
    }
    case 'REMOVE':
      return { ...state, items: state.items.filter(i => i.sku !== action.sku) }
    case 'SET_QTY': {
      if (action.quantity <= 0) {
        return { ...state, items: state.items.filter(i => i.sku !== action.sku) }
      }
      return {
        ...state,
        items: state.items.map(i =>
          i.sku === action.sku ? { ...i, quantity: action.quantity } : i
        ),
      }
    }
    case 'CLEAR':
      return { ...state, items: [] }
    case 'TOGGLE_DRAWER':
      return { ...state, drawerOpen: action.open ?? !state.drawerOpen }
    default:
      return state
  }
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return { items: JSON.parse(saved), drawerOpen: false }
  } catch {}
  return { items: [], drawerOpen: false }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, undefined, loadState)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items))
  }, [state.items])

  const itemCount = state.items.reduce((s, i) => s + i.quantity, 0)
  const total = state.items.reduce((s, i) => s + Number(i.price) * i.quantity, 0)

  const value = {
    items: state.items,
    drawerOpen: state.drawerOpen,
    itemCount,
    total,
    addItem: (item) => dispatch({ type: 'ADD', item }),
    removeItem: (sku) => dispatch({ type: 'REMOVE', sku }),
    setQty: (sku, quantity) => dispatch({ type: 'SET_QTY', sku, quantity }),
    // usuwa rowniez bezposrednio z localStorage — effect moze nie zdazyc przed nawigacja
    clearCart: () => {
      dispatch({ type: 'CLEAR' })
      localStorage.removeItem(STORAGE_KEY)
    },
    openDrawer: () => dispatch({ type: 'TOGGLE_DRAWER', open: true }),
    closeDrawer: () => dispatch({ type: 'TOGGLE_DRAWER', open: false }),
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export const useCart = () => useContext(CartContext)
