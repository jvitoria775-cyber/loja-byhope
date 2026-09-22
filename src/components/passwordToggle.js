import { icon } from './icons.js';

// Botão de "mostrar senha" que funciona sempre, em qualquer navegador -
// diferente do ícone nativo do Chrome/Android, que só aparece às vezes
// dependendo do autofill. Envolve o campo já existente no HTML (sem
// precisar mudar o template de cada página) e alterna o type do input
// entre password/text.
export function attachPasswordToggle(inputId) {
  const input = document.getElementById(inputId);
  if (!input || input.dataset.toggleAttached) return;
  input.dataset.toggleAttached = 'true';

  const wrap = document.createElement('div');
  wrap.className = 'password-field-wrap';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'password-toggle-btn';
  btn.tabIndex = -1;
  btn.setAttribute('aria-label', 'Mostrar senha');
  btn.innerHTML = icon('eye', 'icon icon-sm');
  wrap.appendChild(btn);

  btn.addEventListener('click', () => {
    const willShow = input.type === 'password';
    input.type = willShow ? 'text' : 'password';
    btn.setAttribute('aria-label', willShow ? 'Ocultar senha' : 'Mostrar senha');
    btn.innerHTML = icon(willShow ? 'eyeOff' : 'eye', 'icon icon-sm');
  });
}
