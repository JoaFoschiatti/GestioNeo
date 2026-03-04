// Mapeo de nombres de categoria a emojis para mejor UX visual
const categoryIcons = {
  hamburguesas: '🍔',
  pizzas: '🍕',
  bebidas: '🥤',
  postres: '🍰',
  ensaladas: '🥗',
  carnes: '🥩',
  pastas: '🍝',
  entradas: '🥟',
  sandwiches: '🥪',
  papas: '🍟',
  combos: '🍱',
  default: '🍽️'
}

export const getCategoryEmoji = (nombre) => {
  const key = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  for (const [cat, emoji] of Object.entries(categoryIcons)) {
    if (key.includes(cat)) return emoji
  }
  return categoryIcons.default
}
