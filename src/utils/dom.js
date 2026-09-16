export function qs(sel, ctx = document) {
  return ctx.querySelector(sel);
}

export function qsa(sel, ctx = document) {
  return Array.from(ctx.querySelectorAll(sel));
}

export function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function mediaImg(src, alt, { cls = '', wrapCls = 'media' } = {}) {
  return `<div class="${wrapCls}"><img src="${src}" alt="${escapeHtml(alt)}" class="${cls}" loading="lazy" onerror="window.__imgErr(this)"><div class="media-fallback"><span>GT</span></div></div>`;
}

window.__imgErr = function (imgEl) {
  const wrap = imgEl.closest('.media');
  if (wrap) wrap.classList.add('broken');
};

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
