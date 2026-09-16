import { getItem, setItem, removeItem } from '../utils/storage.js';

const USERS_KEY = 'users';
const SESSION_KEY = 'session';

function getUsers() {
  return getItem(USERS_KEY, []);
}

function saveUsers(users) {
  setItem(USERS_KEY, users);
}

export function getCurrentUser() {
  return getItem(SESSION_KEY, null);
}

function emit() {
  window.dispatchEvent(new CustomEvent('auth:change', { detail: { user: getCurrentUser() } }));
}

export function register({ name, email, password }) {
  const users = getUsers();
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return { ok: false, message: 'Já existe uma conta cadastrada com este e-mail.' };
  }
  const user = { name, email, password };
  users.push(user);
  saveUsers(users);
  setItem(SESSION_KEY, { name, email });
  emit();
  return { ok: true, user: { name, email } };
}

export function login({ email, password }) {
  const users = getUsers();
  const found = users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  if (!found) {
    return { ok: false, message: 'E-mail ou senha incorretos.' };
  }
  setItem(SESSION_KEY, { name: found.name, email: found.email });
  emit();
  return { ok: true, user: { name: found.name, email: found.email } };
}

export function logout() {
  removeItem(SESSION_KEY);
  emit();
}
