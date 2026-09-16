import { getItem, setItem } from '../utils/storage.js';

const KEY = 'favorites';
let favorites = getItem(KEY, []);

function emit() {
  window.dispatchEvent(new CustomEvent('favorites:change', { detail: { favorites } }));
}

export function getFavorites() {
  return favorites;
}

export function isFavorite(id) {
  return favorites.includes(id);
}

export function toggleFavorite(id) {
  if (favorites.includes(id)) {
    favorites = favorites.filter((f) => f !== id);
  } else {
    favorites = [...favorites, id];
  }
  setItem(KEY, favorites);
  emit();
  return favorites.includes(id);
}

export function getFavoritesCount() {
  return favorites.length;
}
