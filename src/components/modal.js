import { icon } from './icons.js';

let lastFocused = null;

export function openModal(innerHtml, { onClose } = {}) {
  const root = document.getElementById('modal-root');
  lastFocused = document.activeElement;
  root.innerHTML = `
    <div class="modal-overlay" data-modal-overlay>
      <div class="modal-box" role="dialog" aria-modal="true">
        <button class="btn-icon modal-close" data-modal-close aria-label="Fechar">${icon('x')}</button>
        ${innerHtml}
      </div>
    </div>`;

  const overlay = root.querySelector('[data-modal-overlay]');
  const close = () => closeModal(onClose);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  root.querySelector('[data-modal-close]').addEventListener('click', close);
  document.addEventListener('keydown', escHandler);

  const box = root.querySelector('.modal-box');
  box.focus?.();
  return { close };
}

function escHandler(e) {
  if (e.key === 'Escape') closeModal();
}

export function closeModal(onClose) {
  const root = document.getElementById('modal-root');
  root.innerHTML = '';
  document.removeEventListener('keydown', escHandler);
  if (lastFocused) lastFocused.focus?.();
  onClose?.();
}
