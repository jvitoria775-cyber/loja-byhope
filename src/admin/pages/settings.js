import { getItem, setItem } from '../../utils/storage.js';
import { getPin, setPin } from '../adminAuth.js';
import { seedDemoData, clearDemoData, isSeeded } from '../mockData.js';
import { getStoreDiscountPercent, setStoreDiscountPercent } from '../../services/catalogService.js';
import { setStockForAllProducts } from '../productAdminStore.js';
import { escapeHtml } from '../../utils/dom.js';
import { icon } from '../../components/icons.js';

const STORE_KEY = 'store_settings';

function getStoreSettings() {
  return getItem(STORE_KEY, { name: '', cnpj: '', email: '', phone: '', cep: '', street: '', number: '', city: '', state: '' });
}

function maskHandle(handle) {
  if (handle.length <= 2) return handle;
  return handle[0] + '•'.repeat(Math.max(handle.length - 2, 1)) + handle[handle.length - 1];
}

export async function render() {
  const store = getStoreSettings();
  const discountPercent = getStoreDiscountPercent();

  return `
    <div class="two-col">
      <div class="panel">
        <h2>Dados da loja</h2>
        <p style="font-size:12px;color:var(--color-text-faint);margin-bottom:14px;">Essas informações são usadas em comprovantes e relatórios exportados. Preencha com os dados reais da empresa.</p>
        <form id="store-form" class="admin-form">
          <label>Razão social / Nome fantasia<input type="text" name="name" value="${escapeHtml(store.name)}" placeholder="Gratitude Têxtil"></label>
          <label>CNPJ<input type="text" name="cnpj" value="${escapeHtml(store.cnpj)}" placeholder="00.000.000/0000-00"></label>
          <div class="form-row">
            <label>E-mail de contato<input type="email" name="email" value="${escapeHtml(store.email)}" placeholder="contato@gratitudetextil.com.br"></label>
            <label>Telefone / WhatsApp<input type="text" name="phone" value="${escapeHtml(store.phone)}" placeholder="(00) 00000-0000"></label>
          </div>
          <div class="form-row">
            <label>CEP<input type="text" name="cep" value="${escapeHtml(store.cep)}" placeholder="00000-000"></label>
            <label>Cidade/UF<input type="text" name="city" value="${escapeHtml(store.city)}" placeholder="Cidade"></label>
          </div>
          <div class="form-row">
            <label>Rua<input type="text" name="street" value="${escapeHtml(store.street)}"></label>
            <label>Número<input type="text" name="number" value="${escapeHtml(store.number)}"></label>
          </div>
          <button type="submit" class="btn btn-primary" style="margin-top:6px;">Salvar dados da loja</button>
          <span id="store-saved-note" class="form-hint" style="display:none;color:var(--color-accent-dark);">Dados salvos.</span>
        </form>
      </div>

      <div class="panel">
        <h2>Integrações</h2>
        <div class="integration-row">
          <div>${icon('creditCard', 'icon')}<div><strong>InfinitePay</strong><span>Gateway de pagamento (Pix e cartão)</span></div></div>
          <div style="text-align:right;">
            <span class="badge-pill badge-pago">Conectado</span>
            <div style="font-size:11.5px;color:var(--color-text-faint);margin-top:4px;">handle: ${escapeHtml(maskHandle('alivio'))}</div>
          </div>
        </div>
        <div class="integration-row">
          <div>${icon('truck', 'icon')}<div><strong>Melhor Envio</strong><span>Cotação e etiquetas de frete</span></div></div>
          <span class="badge-pill badge-pendente">Não configurado</span>
        </div>
        <p style="font-size:11.5px;color:var(--color-text-faint);margin-top:14px;">A configuração do Melhor Envio (transportadoras, token de produção e CEP de origem) será feita em uma etapa futura, a pedido da equipe.</p>
      </div>
    </div>

    <div class="two-col">
      <div class="panel">
        <h2>Segurança</h2>
        <form id="pin-form" class="admin-form">
          <label>PIN atual<input type="password" inputmode="numeric" name="currentPin" required></label>
          <label>Novo PIN<input type="password" inputmode="numeric" name="newPin" minlength="4" required></label>
          <label>Confirmar novo PIN<input type="password" inputmode="numeric" name="confirmPin" minlength="4" required></label>
          <button type="submit" class="btn btn-outline">Alterar PIN</button>
          <span id="pin-error" class="form-hint" style="display:none;color:#B3261E;"></span>
          <span id="pin-saved-note" class="form-hint" style="display:none;color:var(--color-accent-dark);">PIN alterado com sucesso.</span>
        </form>
        <div style="margin-top:18px;border-top:1px solid var(--color-border);padding-top:14px;">
          <label style="font-size:13px;font-weight:600;">E-mail de recuperação (informativo)</label>
          <input type="email" id="recovery-email" placeholder="seuemail@exemplo.com" style="margin-top:6px;width:100%;padding:9px 12px;border:1px solid var(--color-border);border-radius:6px;">
          <p style="font-size:11.5px;color:var(--color-text-faint);margin-top:6px;">Este campo é apenas informativo — como o painel não tem um servidor/backend, não é possível enviar e-mails de recuperação automaticamente. Guarde o PIN em um local seguro.</p>
        </div>
      </div>

      <div class="panel">
        <h2>Dados de demonstração</h2>
        <p style="font-size:12.5px;color:var(--color-text-soft);margin-bottom:14px;">O painel foi pré-carregado com pedidos fictícios (marcados como demonstração) para que você possa testar todas as telas. Você pode gerar mais dados ou limpar tudo a qualquer momento — isso não afeta o catálogo real da loja.</p>
        <p style="font-size:12.5px;margin-bottom:14px;">Status atual: ${isSeeded() ? '<span class="badge-pill badge-pago">Dados de demonstração ativos</span>' : '<span class="badge-pill badge-pendente">Sem dados de demonstração</span>'}</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button type="button" class="btn btn-outline btn-sm" id="reseed-btn">${icon('refresh', 'icon icon-sm')} Gerar mais pedidos demo</button>
          <button type="button" class="btn btn-outline btn-sm" id="clear-demo-btn" style="color:#B3261E;border-color:#B3261E;">${icon('trash', 'icon icon-sm')} Limpar dados de demonstração</button>
        </div>
      </div>
    </div>

    <div class="two-col">
      <div class="panel">
        <h2>Promoção da loja</h2>
        <p style="font-size:12.5px;color:var(--color-text-soft);margin-bottom:14px;">Efeito só de vitrine: o <strong>preço de venda cadastrado continua sendo o valor realmente cobrado</strong> (não muda em nada) — o que aparece é um preço "de" riscado, maior, calculado para que o desconto sobre ele bata exatamente no preço de venda real. Produtos com uma promoção específica definida em Produtos & Estoque (essa sim reduz o valor cobrado) usam aquele valor no lugar deste.</p>
        <p style="font-size:12.5px;margin-bottom:14px;">Status atual: ${discountPercent > 0 ? `<span class="badge-pill badge-pago">Ativo — ${discountPercent}% de desconto</span>` : '<span class="badge-pill badge-pendente">Desativado</span>'}</p>
        <form id="discount-form" class="admin-form">
          <label>Desconto geral (%)<input type="number" min="0" max="99" step="1" name="discount" value="${discountPercent || ''}" placeholder="0 = desativado"></label>
          <button type="submit" class="btn btn-primary btn-sm">Salvar desconto</button>
          <span id="discount-saved-note" class="form-hint" style="display:none;color:var(--color-accent-dark);">Desconto atualizado.</span>
        </form>
      </div>

      <div class="panel">
        <h2>Estoque</h2>
        <p style="font-size:12.5px;color:var(--color-text-soft);margin-bottom:14px;">Define o mesmo estoque para todas as cores e tamanhos de todos os produtos (oficiais e de demonstração) de uma só vez. Depois disso, você ainda pode ajustar cor por cor em Produtos & Estoque.</p>
        <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;">
          <label style="font-size:12.5px;font-weight:600;">Quantidade<input type="number" min="0" id="bulk-stock-input" value="999" style="display:block;margin-top:4px;padding:9px 12px;border:1px solid var(--color-border);border-radius:6px;width:120px;"></label>
          <button type="button" class="btn btn-outline btn-sm" id="bulk-stock-btn">${icon('package', 'icon icon-sm')} Aplicar a todos os produtos</button>
        </div>
        <span id="bulk-stock-note" class="form-hint" style="display:none;color:var(--color-accent-dark);">Estoque atualizado em todos os produtos.</span>
      </div>
    </div>
  `;
}

export async function afterRender() {
  document.getElementById('store-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    setItem(STORE_KEY, data);
    const note = document.getElementById('store-saved-note');
    note.style.display = 'inline';
    setTimeout(() => { note.style.display = 'none'; }, 2500);
  });

  document.getElementById('pin-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const errorEl = document.getElementById('pin-error');
    const savedEl = document.getElementById('pin-saved-note');
    errorEl.style.display = 'none';
    savedEl.style.display = 'none';

    if (data.currentPin !== getPin()) {
      errorEl.textContent = 'PIN atual incorreto.';
      errorEl.style.display = 'inline';
      return;
    }
    if (data.newPin !== data.confirmPin) {
      errorEl.textContent = 'A confirmação não corresponde ao novo PIN.';
      errorEl.style.display = 'inline';
      return;
    }
    setPin(data.newPin);
    e.target.reset();
    savedEl.style.display = 'inline';
    setTimeout(() => { savedEl.style.display = 'none'; }, 2500);
  });

  document.getElementById('reseed-btn').addEventListener('click', () => {
    seedDemoData(20);
    location.hash = '#configuracoes';
    location.reload();
  });

  document.getElementById('clear-demo-btn').addEventListener('click', () => {
    if (!confirm('Remover todos os pedidos de demonstração? Pedidos reais (feitos pela loja ou PDV) não serão afetados.')) return;
    clearDemoData();
    location.reload();
  });

  document.getElementById('discount-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const value = Number(new FormData(e.target).get('discount')) || 0;
    setStoreDiscountPercent(value);
    const note = document.getElementById('discount-saved-note');
    note.style.display = 'inline';
    setTimeout(() => { location.reload(); }, 700);
  });

  document.getElementById('bulk-stock-btn').addEventListener('click', () => {
    const qty = Number(document.getElementById('bulk-stock-input').value) || 0;
    if (!confirm(`Definir estoque de ${qty} unidades para TODAS as cores e tamanhos de TODOS os produtos?`)) return;
    setStockForAllProducts(qty);
    const note = document.getElementById('bulk-stock-note');
    note.style.display = 'inline';
  });
}
