import { changePin } from '../adminAuth.js';
import { seedDemoData, clearDemoData, hasDemoOrders } from '../mockData.js';
import { getAllOrders } from '../orderStore.js';
import {
  getStoreSettings, saveStoreSettings, getStoreDiscountPercent, setStoreDiscountPercent,
  getShippingConfig, saveShippingConfig, getMelhorEnvioStatus,
} from '../settingsStore.js';
import { setStockForAllProducts } from '../productAdminStore.js';
import { escapeHtml } from '../../utils/dom.js';
import { icon } from '../../components/icons.js';

function maskHandle(handle) {
  if (handle.length <= 2) return handle;
  return handle[0] + '•'.repeat(Math.max(handle.length - 2, 1)) + handle[handle.length - 1];
}

const CATEGORY_LABELS = {
  camiseta: 'Camisetas', babylook: 'Baby Look', cropped: 'Cropped',
  regata: 'Regata', moletom: 'Moletom', short: 'Shorts',
};
const DEFAULT_CATEGORY_WEIGHTS_KG = {
  camiseta: 0.2, babylook: 0.15, cropped: 0.15, regata: 0.15, moletom: 0.6, short: 0.25,
};
const STATES = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

export async function render() {
  const [store, discountPercent, orders, shippingConfig, melhorEnvio] = await Promise.all([
    getStoreSettings(), getStoreDiscountPercent(), getAllOrders(), getShippingConfig(), getMelhorEnvioStatus(),
  ]);
  const seeded = hasDemoOrders(orders);

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
            <label>Bairro<input type="text" name="district" value="${escapeHtml(store.district || '')}"></label>
          </div>
          <div class="form-row">
            <label>Rua<input type="text" name="street" value="${escapeHtml(store.street)}"></label>
            <label>Número<input type="text" name="number" value="${escapeHtml(store.number)}"></label>
          </div>
          <div class="form-row">
            <label>Cidade<input type="text" name="city" value="${escapeHtml(store.city)}" placeholder="Cidade"></label>
            <label>Estado (UF)
              <select name="state">
                <option value="">Selecione</option>
                ${STATES.map((s) => `<option value="${s}" ${store.state === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </label>
          </div>
          <p style="font-size:11px;color:var(--color-text-faint);">CEP, bairro, rua, número, cidade e UF completos são usados como endereço de origem para calcular e comprar o frete pelo Melhor Envio.</p>
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
          <div>${icon('truck', 'icon')}<div><strong>Melhor Envio</strong><span>Cotação e etiquetas de frete (Correios)</span></div></div>
          <div style="text-align:right;">
            ${melhorEnvio.connected
              ? `<span class="badge-pill badge-pago">Conectado${melhorEnvio.env === 'sandbox' ? ' (sandbox)' : ''}</span>`
              : `<a href="/api/shipping" class="btn btn-outline btn-sm">Conectar Melhor Envio</a>`}
          </div>
        </div>
        ${melhorEnvio.connected ? `<p style="font-size:11.5px;color:var(--color-text-faint);margin-top:10px;">Conectado ${melhorEnvio.env === 'sandbox' ? 'em modo de testes (sandbox) — nenhuma etiqueta real é cobrada' : 'em produção'}. Para reconectar ou trocar de conta, clique em <a href="/api/shipping">Conectar Melhor Envio</a> novamente.</p>` : ''}
      </div>
    </div>

    <div class="two-col">
      <div class="panel">
        <h2>Frete — caixa padrão</h2>
        <p style="font-size:12.5px;color:var(--color-text-soft);margin-bottom:14px;">Dimensões da caixa/envelope padrão usada para calcular e comprar o frete. Vale para qualquer pedido, independente da quantidade de peças.</p>
        <form id="package-form" class="admin-form">
          <div class="form-row">
            <label>Largura (cm)<input type="number" min="1" step="1" name="packageWidthCm" value="${shippingConfig.packageWidthCm}"></label>
            <label>Altura (cm)<input type="number" min="1" step="1" name="packageHeightCm" value="${shippingConfig.packageHeightCm}"></label>
          </div>
          <label style="max-width:200px;">Comprimento (cm)<input type="number" min="1" step="1" name="packageLengthCm" value="${shippingConfig.packageLengthCm}"></label>
          <button type="submit" class="btn btn-outline btn-sm" style="margin-top:6px;">Salvar caixa padrão</button>
          <span id="package-saved-note" class="form-hint" style="display:none;color:var(--color-accent-dark);">Salvo.</span>
        </form>
      </div>

      <div class="panel">
        <h2>Frete — peso por categoria</h2>
        <p style="font-size:12.5px;color:var(--color-text-soft);margin-bottom:14px;">Peso aproximado de cada peça, usado para somar o peso total do pedido na cotação e na compra do frete.</p>
        <form id="weights-form" class="admin-form">
          <div class="form-row" style="grid-template-columns:1fr 1fr 1fr;">
            ${Object.keys(CATEGORY_LABELS).map((cat) => `
              <label>${CATEGORY_LABELS[cat]} (kg)<input type="number" min="0" step="0.01" name="weight-${cat}" value="${shippingConfig.categoryWeights?.[cat] ?? DEFAULT_CATEGORY_WEIGHTS_KG[cat]}"></label>
            `).join('')}
          </div>
          <button type="submit" class="btn btn-outline btn-sm" style="margin-top:6px;">Salvar pesos</button>
          <span id="weights-saved-note" class="form-hint" style="display:none;color:var(--color-accent-dark);">Salvo.</span>
        </form>
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
        <p style="font-size:12.5px;margin-bottom:14px;">Status atual: ${seeded ? '<span class="badge-pill badge-pago">Dados de demonstração ativos</span>' : '<span class="badge-pill badge-pendente">Sem dados de demonstração</span>'}</p>
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

export async function afterRender(query = {}) {
  if (query.melhor_envio === 'conectado') {
    alert('Melhor Envio conectado com sucesso!');
    location.hash = '#configuracoes';
  } else if (query.melhor_envio === 'erro') {
    alert(`Não foi possível conectar ao Melhor Envio: ${query.msg || 'erro desconhecido.'}`);
    location.hash = '#configuracoes';
  }

  document.getElementById('store-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    await saveStoreSettings(data);
    btn.disabled = false;
    const note = document.getElementById('store-saved-note');
    note.style.display = 'inline';
    setTimeout(() => { note.style.display = 'none'; }, 2500);
  });

  document.getElementById('package-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    const current = await getShippingConfig();
    await saveShippingConfig({
      ...current,
      packageWidthCm: Number(data.packageWidthCm) || current.packageWidthCm,
      packageHeightCm: Number(data.packageHeightCm) || current.packageHeightCm,
      packageLengthCm: Number(data.packageLengthCm) || current.packageLengthCm,
    });
    btn.disabled = false;
    const note = document.getElementById('package-saved-note');
    note.style.display = 'inline';
    setTimeout(() => { note.style.display = 'none'; }, 2500);
  });

  document.getElementById('weights-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    const current = await getShippingConfig();
    const categoryWeights = { ...current.categoryWeights };
    Object.keys(CATEGORY_LABELS).forEach((cat) => {
      const value = Number(data[`weight-${cat}`]);
      if (value > 0) categoryWeights[cat] = value;
    });
    await saveShippingConfig({ ...current, categoryWeights });
    btn.disabled = false;
    const note = document.getElementById('weights-saved-note');
    note.style.display = 'inline';
    setTimeout(() => { note.style.display = 'none'; }, 2500);
  });

  document.getElementById('pin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const errorEl = document.getElementById('pin-error');
    const savedEl = document.getElementById('pin-saved-note');
    errorEl.style.display = 'none';
    savedEl.style.display = 'none';

    if (data.newPin !== data.confirmPin) {
      errorEl.textContent = 'A confirmação não corresponde ao novo PIN.';
      errorEl.style.display = 'inline';
      return;
    }
    try {
      await changePin(data.currentPin, data.newPin);
      e.target.reset();
      savedEl.style.display = 'inline';
      setTimeout(() => { savedEl.style.display = 'none'; }, 2500);
    } catch (err) {
      errorEl.textContent = err.message || 'PIN atual incorreto.';
      errorEl.style.display = 'inline';
    }
  });

  document.getElementById('reseed-btn').addEventListener('click', async () => {
    await seedDemoData(20);
    location.hash = '#configuracoes';
    location.reload();
  });

  document.getElementById('clear-demo-btn').addEventListener('click', async () => {
    if (!confirm('Remover todos os pedidos de demonstração? Pedidos reais (feitos pela loja ou PDV) não serão afetados.')) return;
    await clearDemoData();
    location.reload();
  });

  document.getElementById('discount-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = Number(new FormData(e.target).get('discount')) || 0;
    await setStoreDiscountPercent(value);
    const note = document.getElementById('discount-saved-note');
    note.style.display = 'inline';
    setTimeout(() => { location.reload(); }, 700);
  });

  document.getElementById('bulk-stock-btn').addEventListener('click', async (e) => {
    const qty = Number(document.getElementById('bulk-stock-input').value) || 0;
    if (!confirm(`Definir estoque de ${qty} unidades para TODAS as cores e tamanhos de TODOS os produtos?`)) return;
    e.currentTarget.disabled = true;
    await setStockForAllProducts(qty);
    e.currentTarget.disabled = false;
    const note = document.getElementById('bulk-stock-note');
    note.style.display = 'inline';
  });
}
