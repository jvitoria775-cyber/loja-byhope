import { isUnlocked, renderGate } from './adminAuth.js';
import { initAdminRouter } from './adminRouter.js';
import { ensureSeeded } from './mockData.js';

function init() {
  if (isUnlocked()) {
    boot();
  } else {
    renderGate(boot);
  }
}

function boot() {
  ensureSeeded();
  initAdminRouter();
}

init();
