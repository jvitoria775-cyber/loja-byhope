import { icon } from './icons.js';
import { escapeHtml } from '../utils/dom.js';

const ICONS = { success: 'checkCircle', error: 'x', info: 'sparkle' };

export function showToast(message, type = 'success', duration = 3200) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `${icon(ICONS[type] || 'sparkle', 'icon icon-sm')}<span>${escapeHtml(message)}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 0.3s, transform 0.3s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 300);
  }, duration);
}
