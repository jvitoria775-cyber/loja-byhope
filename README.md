# Gratitude Têxtil — Site Oficial

**Site publicado:** https://loja-byhope.vercel.app

Site institucional e catálogo da **Gratitude Têxtil**, confecção de peças básicas em atacado (camisetas, baby look, cropped, regata, moletom canguru e shorts). Todo o conteúdo — logo, produtos, fotos, descrições e preços — é real, baseado nos materiais oficiais fornecidos pela empresa.

## Tecnologias utilizadas

Frontend sem etapa de build (sem framework/bundler):

- **HTML5 semântico**
- **CSS3 moderno** (variáveis CSS, Grid, Flexbox, animações), seguindo a identidade visual oficial (dourado/preto do logo)
- **JavaScript (ES2020+) puro, com ES Modules** — sem dependência de React/Vite
- **Roteamento client-side** por hash (`#/produtos`, `#/produto/:slug`, etc.)
- **Google Fonts** (Playfair Display + Inter) via CDN

Backend/dados (publicado na Vercel):

- **Funções serverless Node.js** em `/api` (uma dependência real: `@vercel/postgres`) — banco de dados compartilhado, autenticação do painel e a ponte segura com a InfinitePay
- **Postgres** (Vercel Postgres / Neon) — pedidos, clientes, ajustes de estoque/preço/promoção e configurações da loja, compartilhados entre qualquer computador/aparelho que acesse o site
- `localStorage` continua usado só para o que é individual de cada visitante antes de finalizar a compra: carrinho, favoritos e cupom aplicado

Ambiente de desenvolvimento local (sem Node/Python/gerenciador de pacotes instalado):

- **`server.ps1`**, escrito em PowerShell usando `System.Net.HttpListener` (nativo do Windows/.NET) — serve os arquivos estáticos localmente para pré-visualização. As rotas de `/api` (banco de dados, autenticação, InfinitePay) **só funcionam no ambiente publicado na Vercel** - o PowerShell não roda Postgres nem as funções serverless.

## Como publicar (deploy)

O projeto é feito para publicar na **Vercel** (plano gratuito), usando o repositório GitHub já configurado:

1. Crie uma conta na [vercel.com](https://vercel.com) fazendo login com o GitHub (mesma conta do repositório) - sem senha nova para lembrar.
2. **Add New → Project** e importe o repositório `loja-byhope`.
3. Antes ou logo depois do primeiro deploy, vá na aba **Storage** do projeto e clique em **Create Database → Postgres** (Neon). Isso cria automaticamente a variável de ambiente `POSTGRES_URL` usada pelas funções em `/api`.
4. Em **Settings → Environment Variables**, adicione:
   - `ADMIN_TOKEN_SECRET` — qualquer string longa e aleatória (usada para assinar a sessão do painel administrativo).
   - `INFINITEPAY_HANDLE` — a InfiniteTag da conta que recebe os pagamentos (`alivio` por padrão).
5. Rode o script `db/schema.sql` **uma única vez** no editor de query do Postgres (aba Storage do projeto na Vercel, ou no console da Neon) - ele cria as tabelas e os valores padrão (desconto geral 27%, dados da loja em branco).
6. Deploy. O site fica disponível em um link `https://SEU-PROJETO.vercel.app` (dá pra configurar um domínio próprio depois, em Settings → Domains).

Depois disso, qualquer novo `git push` para o branch `main` publica automaticamente uma nova versão.

## Como executar localmente (só a pré-visualização estática)

```powershell
powershell -ExecutionPolicy Bypass -File server.ps1
```

Acesse **http://localhost:5173/** no navegador (a porta muda automaticamente se 5173 estiver ocupada — o terminal informa a porta correta). Para encerrar, pressione `CTRL+C`. Lembrando: sem o deploy na Vercel, o catálogo, o painel, o PDV e o checkout não funcionam de verdade nesse modo local, porque dependem das rotas de `/api` e do banco Postgres.

## Estrutura do projeto

```
projeto/
├── api/                    # Funções serverless (Vercel/Node) - banco de dados, autenticação, InfinitePay
│   ├── orders/, customers/, products/  # CRUD de cada recurso
│   ├── settings.js, auth.js, demo.js, create-payment-link.js
│   └── _db.js, _auth.js    # helpers compartilhados (não viram rota, por causa do "_")
├── db/schema.sql            # Schema do Postgres - rodar uma vez ao provisionar o banco
├── public/
│   ├── brand/            # Logo oficial (Gratitude Têxtil), original e otimizado
│   ├── products/          # Fotos reais dos produtos, por categoria e cor
│   ├── sizeguides/        # Tabelas de medidas oficiais, por categoria
│   └── favicon-monogram.png
├── src/
│   ├── admin/              # Painel administrativo e PDV (ver seção própria abaixo)
│   ├── components/        # Header, footer, ícones, card de produto, carrinho, modal, toast, guia de tamanhos
│   ├── context/            # Carrinho, favoritos, autenticação (localStorage)
│   ├── css/main.css        # Design system (cores da marca, tipografia, responsividade)
│   ├── data/products.js    # Catálogo real (6 categorias, cores e preços) - nunca alterado em runtime
│   ├── pages/               # Uma função render()/afterRender() por página
│   ├── services/             # catalogService.js (leitura pública do catálogo), frete simulado, cupons
│   ├── utils/                 # Helpers de formatação, DOM e storage
│   ├── router.js
│   └── main.js
├── index.html
├── package.json             # Dependência das funções /api (@vercel/postgres)
├── server.ps1                # Pré-visualização estática local (ver "Como executar localmente")
└── README.md
```

## Origem dos dados (fonte oficial: Google Drive da empresa)

Todo o conteúdo do site foi extraído da pasta oficial "SITE GRATITU TEXTIL" fornecida pela empresa:

- **Logo**: arquivo `sem fundo 1.png` (pasta "LOGO NOME"), usado exatamente como fornecido — apenas redimensionado para uso web (o arquivo original também está preservado em `public/brand/logo-gratitude-textil.png`).
- **Produtos e fotos**: 90 fotos reais dos produtos foram baixadas das pastas por categoria (Baby Look, Camisetas, Cropped, Moletom, Regata, Short Tectel) e otimizadas para a web (redimensionadas e comprimidas, sem alterar o conteúdo visual).
- **Tabelas de medidas**: as imagens oficiais de tamanhos (P/M/G/GG, com largura/altura em cm) de cada categoria são exibidas no guia de tamanhos de cada produto.
- **Descrições**: escritas a partir dos arquivos `EXPECIFICAÇÕES.txt` de cada categoria (composição, tecido, gramatura, acabamento).
- **Preços**: calculados a partir do arquivo `CUSTO.txt` oficial, com a fórmula:

  ```
  Preço de venda = (Custo do produto + Custo fixo de envio/embalagem) ÷ 0,70
  ```

  Isso garante 30% de margem líquida sobre o preço final de venda (não 30% sobre o custo). Os valores foram arredondados comercialmente para cima (nunca reduzindo a margem abaixo de 30%). Custo fixo de envio/embalagem considerado: saquinho + etiqueta + fita + etiquetas + mão de obra = R$ 3,10 por peça, conforme o arquivo de custos.

  > **Atenção**: o arquivo `CUSTO.txt` também lista encargos percentuais (imposto 10% e taxa de meio de pagamento 6%) que **não foram incluídos** no cálculo acima — a fórmula usada foi a informada explicitamente para este projeto. Se esses encargos também devem reduzir a margem líquida final, os preços precisam ser recalculados com o divisor ajustado (0,70 − 0,10 − 0,06 = 0,54) — vale confirmar com o financeiro antes de publicar.

## Observações importantes

- **Contato**: a pasta do Google Drive não continha telefone, WhatsApp, e-mail comercial, endereço ou redes sociais oficiais da empresa. A página de Contato mantém apenas o formulário funcional; esses dados precisam ser adicionados por quem tiver essa informação (arquivo `src/pages/contact.js`).
- **Sem dados fictícios**: nenhum produto, preço, desconto, avaliação, "mais vendido" ou depoimento fictício foi mantido no site — todo o conteúdo anterior (de uma versão de demonstração) foi removido.
- **Estoque**: como não havia dados reais de estoque por tamanho, todos os tamanhos são tratados como disponíveis (não há reivindicação de "últimas unidades" ou indisponibilidade inventada).
- **Persistência local**: carrinho, favoritos, cupom, frete e pedidos ficam salvos no `localStorage` do navegador utilizado.
- **Pagamento (real, via InfinitePay)**: o checkout usa a API oficial de Checkout Integrado da InfinitePay (`https://www.infinitepay.io/checkout-documentacao`). Ao confirmar o pedido, o cliente é redirecionado para a página segura da InfinitePay, onde escolhe Pix ou cartão de crédito (até 12x) — nenhum dado de cartão passa pelo nosso site. Veja a seção **Pagamento com InfinitePay** abaixo para detalhes técnicos e limitações do ambiente local.

## Painel Administrativo e PDV (venda no balcão)

Duas telas internas, separadas da loja e não linkadas no menu público:

- **`/admin.html`** — Painel administrativo completo, com menu lateral (sidebar) e navegação fluida por hash-router (sem recarregar a página), em 6 seções:
  1. **Visão Geral** — cartões de faturamento total/do mês, ticket médio, novos clientes e estoque baixo; gráfico de vendas ao longo do tempo (7/14/30 dias, SVG desenhado à mão, sem biblioteca externa); produtos mais vendidos; lista de estoque baixo.
  2. **Pedidos** — tabela com paginação, busca, filtros rápidos por status (Pendentes/Pagos/Em separação/Enviados/Cancelados) e por canal (loja online/PDV); modal de detalhe com itens, endereço, forma de pagamento, edição do código de rastreio, linha do tempo de status e exportação de comprovante imprimível.
  3. **Clientes (CRM)** — lista agregada a partir dos pedidos (agrupados por e-mail) + contatos cadastrados manualmente; perfil com histórico de pedidos e LTV (total gasto); cadastro manual de cliente; exportação em CSV.
  4. **Produtos & Estoque** — tabela do catálogo com custo, preço e estoque total; edição de preço e **preço promocional** (opcional — quando definido, vira o preço cobrado, com o valor normal riscado ao lado e um selo de desconto); seção **Variações**, que mostra as fotos e cores reais de cada produto ao editar — clicando em uma cor, o estoque por tamanho (P ao GG) exibido abaixo passa a ser o **daquela cor especificamente**, permitindo controlar, por exemplo, 20 camisetas pretas no P e 5 brancas no mesmo tamanho; cadastro de produtos de demonstração; produtos oficiais só podem ser "ocultados" do painel (nunca excluídos, pois o catálogo real vive em `src/data/products.js`). Alterações de estoque e preço feitas aqui aparecem imediatamente na loja e no PDV (veja "Sincronização" abaixo).
  5. **Financeiro & Relatórios** — receita bruta, custo dos produtos (usando os custos reais por categoria), impostos e taxas de pagamento estimados, lucro líquido estimado; filtro por período (7 dias/este mês/mês anterior/personalizado); exportação em CSV e relatório imprimível.
  6. **Configurações** — dados da loja (nome, CNPJ, contato, endereço — em branco por padrão, sem dados fictícios); status das integrações (InfinitePay conectado, Melhor Envio ainda não configurado); troca de PIN de acesso; geração/limpeza dos dados de demonstração.
- **`/pdv.html`** — Frente de caixa (PDV) para vendas no balcão: catálogo com todas as cores/tamanhos reais, carrinho da venda, desconto manual em R$, e três formas de pagamento: **Dinheiro**, **Cartão (maquininha)** — registra a venda como paga na hora — ou **Pix/Cartão via InfinitePay** — gera um link/cobrança real pela mesma integração do checkout, para o cliente pagar pelo celular no balcão.

Acesso protegido por um **PIN compartilhado da equipe** (padrão `2026`, alterável na tela de Configurações). Diferente de uma versão anterior deste projeto, o PIN agora é validado de verdade no servidor (`/api/auth`, hash PBKDF2, nunca em texto puro) e as rotas do painel que gravam dados exigem esse token - não é mais possível simplesmente pular a tela de PIN chamando a API direto. Ainda assim, continua sendo um PIN único por equipe (como uma senha de alarme de loja), não contas individuais por funcionário.

Totalmente responsivo: em telas estreitas o menu lateral vira um menu "hambúrguer" deslizante.

**Banco de dados compartilhado**: pedidos, clientes cadastrados manualmente, ajustes de estoque/preço/promoção e configurações da loja vivem num banco Postgres compartilhado (ver "Como publicar" acima), não mais em `localStorage`. Isso quer dizer que um pedido feito por um cliente no celular dele aparece no painel administrativo aberto em qualquer outro computador, e uma alteração de estoque feita no painel aparece na loja e no PDV instantaneamente, não importa o aparelho. O carrinho de compras continua em `localStorage` (é estado só do visitante, até finalizar a compra), assim como qualquer loja real.

**Dados de demonstração**: diferente de uma versão anterior, o painel **não gera mais pedidos fictícios sozinho** ao abrir (não faria sentido popular um banco de produção real com dados falsos automaticamente). Em Configurações, o botão "Gerar mais pedidos demo" continua disponível para testar as telas com dados realistas quando quiser — os pedidos criados assim ficam marcados como demonstração e podem ser apagados a qualquer momento sem afetar pedidos reais.

**Estoque por cor e tamanho**: como o catálogo real nunca teve estoque separado por cor (só por tamanho, valendo igual para todas as cores de uma peça), o painel usa esse valor original como ponto de partida "cheio" para cada cor — e a partir daí, cada combinação de cor + tamanho pode ser ajustada individualmente em Produtos & Estoque. Na loja, a página do produto e o PDV passam a respeitar o estoque da cor selecionada (tamanhos sem estoque naquela cor ficam desabilitados). O valor padrão (antes de qualquer ajuste) é **999 unidades por combinação de cor + tamanho**; em Configurações há um botão para reaplicar esse (ou outro) valor a todos os produtos de uma vez.

**Promoção geral da loja**: em Configurações > Promoção da loja, é possível definir um desconto percentual (padrão: **ativo em 27%**) aplicado automaticamente a todos os produtos. É um efeito só de vitrine: o **preço de venda cadastrado é o valor realmente cobrado e não muda em nada** — o que aparece é um preço "de" riscado, maior, calculado de forma que o desconto sobre ele bata exatamente no preço de venda real (ex.: produto de R$18,90 aparece como "de R$25,90 por R$18,90 -27%", mas o cliente paga R$18,90, o mesmo valor de sempre). Isso vale na loja, no PDV e no painel. Já a promoção específica de um produto, definida em Produtos & Estoque, é diferente: essa sim reduz de verdade o valor cobrado, e tem prioridade sobre o desconto geral quando definida. Para desativar o desconto geral, basta colocar 0% em Configurações.

## Pagamento com InfinitePay

`api/create-payment-link.js` (função serverless na Vercel) funciona como ponte segura entre o site e a API oficial da InfinitePay:

1. O navegador envia os itens do pedido e o total para `/api/create-payment-link`.
2. A função chama `POST https://api.checkout.infinitepay.io/links`, usando a InfiniteTag configurada na variável de ambiente `INFINITEPAY_HANDLE` (padrão `alivio`) — **a tag nunca aparece no código do navegador**.
3. A InfinitePay devolve um link de pagamento único; a função repassa esse link para o navegador, que redireciona o cliente para lá.
4. Depois de pagar (Pix ou cartão em até 12x), a InfinitePay redireciona o cliente de volta para `#/pedido/<id>` no site, com `capture_method` e `transaction_nsu` — a página de confirmação chama `PATCH /api/orders/:id/confirm-payment` (rota pública, mas que só altera os campos de pagamento do pedido) para marcar o pedido como "Pago" no banco compartilhado.

**Para trocar a InfiniteTag** (conta que recebe os pagamentos): altere a variável de ambiente `INFINITEPAY_HANDLE` em Settings → Environment Variables no painel da Vercel, e faça um novo deploy.

**Limitações importantes:**
- Como o site publicado tem um domínio público de verdade, o `redirect_url` funciona corretamente para qualquer cliente, em qualquer aparelho (diferente do ambiente 100% local anterior).
- Não há `webhook_url` configurado (exigiria configuração adicional na conta InfinitePay). Isso significa que a confirmação de pagamento hoje depende do cliente ser redirecionado de volta corretamente — se ele fechar a aba antes de voltar, o pedido fica marcado como "Aguardando confirmação" até alguém confirmar manualmente no painel. Para produção com maior volume, o ideal é configurar o webhook oficial da InfinitePay com verificação de assinatura, para confirmar pagamentos de forma servidor-a-servidor.
- Testei a integração de ponta a ponta (do carrinho até a página real de pagamento da InfinitePay, com a InfiniteTag `alivio`) e o link de pagamento é gerado corretamente. Não finalizei nenhum pagamento de teste — isso só pode ser validado com um cartão ou Pix reais.

## Funcionalidades

Home, catálogo com busca/filtros/ordenação, página de produto (galeria que troca por cor, seleção de tamanho, guia de medidas oficial), carrinho (drawer + página), cupons promocionais (`BEMVINDO10`, `MODA10`, `PRIMEIRACOMPRA`, `FRETEGRATIS`), frete simulado por CEP, checkout completo até a confirmação do pedido, favoritos, login/cadastro mockados, páginas institucionais (Sobre, Contato, Política de Privacidade, Termos, Trocas, Frete), responsividade mobile-first.
