import { isUnlocked, renderGate } from './adminAuth.js';
import { initAdminRouter } from './adminRouter.js';

function init() {
  if (isUnlocked()) {
    boot();
  } else {
    renderGate(boot);
  }
}

function boot() {
  initAdminRouter();
}

init();
