# Gratitude Têxtil — Site Oficial

Site institucional e catálogo da **Gratitude Têxtil**, confecção de peças básicas em atacado (camisetas, baby look, cropped, regata, moletom canguru e shorts). Todo o conteúdo — logo, produtos, fotos, descrições e preços — é real, baseado nos materiais oficiais fornecidos pela empresa.

## Tecnologias utilizadas

Sem etapa de build (sem Node.js/npm — o ambiente de desenvolvimento não possuía Node, Python nem gerenciadores de pacote instalados):

- **HTML5 semântico**
- **CSS3 moderno** (variáveis CSS, Grid, Flexbox, animações), seguindo a identidade visual oficial (dourado/preto do logo)
- **JavaScript (ES2020+) puro, com ES Modules** — sem dependência de React/Vite
- **Roteamento client-side** por hash (`#/produtos`, `#/produto/:slug`, etc.)
- **LocalStorage** para persistir carrinho, favoritos, cupom, frete escolhido, conta mockada e pedidos
- **Google Fonts** (Playfair Display + Inter) via CDN
- **Servidor local próprio** (`server.ps1`), escrito em PowerShell usando `System.Net.HttpListener` (nativo do Windows/.NET), sem dependências externas

## Como instalar

Não há dependências para instalar — não é necessário `npm install`. Basta ter o Windows com PowerShell.

## Como executar

```powershell
powershell -ExecutionPolicy Bypass -File server.ps1
```

Acesse **http://localhost:5173/** no navegador (a porta muda automaticamente se 5173 estiver ocupada — o terminal informa a porta correta). Para encerrar, pressione `CTRL+C`.

## Estrutura do projeto

```
projeto/
├── public/
│   ├── brand/            # Logo oficial (Gratitude Têxtil), original e otimizado
│   ├── products/          # Fotos reais dos produtos, por categoria e cor
│   ├── sizeguides/        # Tabelas de medidas oficiais, por categoria
│   └── favicon-monogram.png
├── src/
│   ├── components/        # Header, footer, ícones, card de produto, carrinho, modal, toast, guia de tamanhos
│   ├── context/            # Carrinho, favoritos, autenticação (localStorage)
│   ├── css/main.css        # Design system (cores da marca, tipografia, responsividade)
│   ├── data/products.js    # Catálogo real (6 categorias, cores e preços)
│   ├── pages/               # Uma função render()/afterRender() por página
│   ├── services/             # Busca/filtro/ordenação, frete simulado, cupons
│   ├── utils/                 # Helpers de formatação, DOM e storage
│   ├── router.js
│   └── main.js
├── index.html
├── server.ps1
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

Acesso protegido por um **PIN local** (padrão `2026`, alterável na tela de Configurações — fica salvo no `localStorage`, em `src/admin/adminAuth.js`) — é só uma trava simples, não uma autenticação de servidor de verdade.

Totalmente responsivo: em telas estreitas o menu lateral vira um menu "hambúrguer" deslizante.

**Dados de demonstração**: na primeira vez que o painel é aberto, ele gera automaticamente ~46 pedidos fictícios (marcados internamente como `demo: true`) usando os produtos reais do catálogo, para que todas as telas já apareçam prontas para teste. Esses pedidos podem ser regenerados ou apagados a qualquer momento em Configurações, sem afetar pedidos reais feitos pela loja ou pelo PDV.

**Sincronização loja ↔ painel ↔ PDV (estoque, preço e promoção)**: a loja, o PDV e o painel administrativo leem o catálogo pela mesma camada (`src/services/catalogService.js`), que aplica por cima do catálogo real qualquer ajuste de estoque/preço/preço promocional salvo no painel (`localStorage`, chave `product_overrides`). Ou seja: alterar o estoque ou o preço de um produto em Produtos & Estoque passa a valer imediatamente na vitrine, na página do produto e no PDV, no mesmo navegador/computador. O arquivo de origem `src/data/products.js` nunca é alterado.

**Estoque por cor e tamanho**: como o catálogo real nunca teve estoque separado por cor (só por tamanho, valendo igual para todas as cores de uma peça), o painel usa esse valor original como ponto de partida "cheio" para cada cor — e a partir daí, cada combinação de cor + tamanho pode ser ajustada individualmente em Produtos & Estoque. Na loja, a página do produto e o PDV passam a respeitar o estoque da cor selecionada (tamanhos sem estoque naquela cor ficam desabilitados). O valor padrão (antes de qualquer ajuste) é **999 unidades por combinação de cor + tamanho**; em Configurações há um botão para reaplicar esse (ou outro) valor a todos os produtos de uma vez.

**Promoção geral da loja**: em Configurações > Promoção da loja, é possível definir um desconto percentual (padrão: **ativo em 27%**) aplicado automaticamente a todos os produtos. É um efeito só de vitrine: o **preço de venda cadastrado é o valor realmente cobrado e não muda em nada** — o que aparece é um preço "de" riscado, maior, calculado de forma que o desconto sobre ele bata exatamente no preço de venda real (ex.: produto de R$18,90 aparece como "de R$25,90 por R$18,90 -27%", mas o cliente paga R$18,90, o mesmo valor de sempre). Isso vale na loja, no PDV e no painel. Já a promoção específica de um produto, definida em Produtos & Estoque, é diferente: essa sim reduz de verdade o valor cobrado, e tem prioridade sobre o desconto geral quando definida. Para desativar o desconto geral, basta colocar 0% em Configurações.

**Importante sobre os dados**: painel e PDV leem os pedidos do mesmo `localStorage` da loja. Isso significa que, hoje, cada computador/navegador só vê os pedidos feitos nele mesmo — não existe um banco de dados central compartilhando pedidos (nem os ajustes de estoque/preço) entre o caixa da loja e os clientes online em outros dispositivos. O mesmo vale para clientes cadastrados manualmente e para produtos de demonstração criados no painel. Para isso funcionar de verdade com múltiplos pontos de venda, computadores e clientes reais ao mesmo tempo, é necessário um backend com banco de dados compartilhado no lugar do `localStorage`.

## Pagamento com InfinitePay

O `server.ps1` expõe uma única rota de API, **`POST /api/create-payment-link`**, que funciona como ponte segura entre o site e a API oficial da InfinitePay:

1. O navegador envia os itens do pedido e o total para `/api/create-payment-link` (no próprio servidor local).
2. O servidor (PowerShell) chama `POST https://api.checkout.infinitepay.io/links`, usando a InfiniteTag configurada (`-InfinitePayHandle`, padrão `alivio`) — **a tag nunca aparece no código do navegador**.
3. A InfinitePay devolve um link de pagamento único; o servidor repassa esse link para o navegador, que redireciona o cliente para lá.
4. Depois de pagar (Pix ou cartão em até 12x), a InfinitePay redireciona o cliente de volta para `#/pedido/<id>` no site, com `capture_method` e `transaction_nsu` — a página de confirmação usa isso para marcar o pedido como "Pago".

**Para trocar a InfiniteTag** (conta que recebe os pagamentos):
```powershell
powershell -ExecutionPolicy Bypass -File server.ps1 -InfinitePayHandle "sua_tag_aqui"
```

**Limitações importantes do ambiente atual:**
- O redirecionamento de volta (`redirect_url`) aponta para `localhost` — isso só funciona testando no mesmo computador onde o servidor está rodando. Para uso real com clientes de verdade, o site precisa estar publicado em um domínio público, e o `server.ps1` (ou um backend equivalente) precisa estar acessível pela internet.
- Não há `webhook_url` configurado (exigiria um endereço público). Isso significa que a confirmação de pagamento hoje depende do cliente ser redirecionado de volta corretamente — para produção, o ideal é configurar o webhook oficial da InfinitePay para confirmar pagamentos mesmo se o cliente fechar a aba antes de voltar.
- Testei a integração de ponta a ponta (do carrinho até a página real de pagamento da InfinitePay, com a InfiniteTag `alivio`) e o link de pagamento é gerado corretamente. Não finalizei nenhum pagamento de teste — isso só pode ser validado com um cartão ou Pix reais.

## Funcionalidades

Home, catálogo com busca/filtros/ordenação, página de produto (galeria que troca por cor, seleção de tamanho, guia de medidas oficial), carrinho (drawer + página), cupons promocionais (`BEMVINDO10`, `MODA10`, `PRIMEIRACOMPRA`, `FRETEGRATIS`), frete simulado por CEP, checkout completo até a confirmação do pedido, favoritos, login/cadastro mockados, páginas institucionais (Sobre, Contato, Política de Privacidade, Termos, Trocas, Frete), responsividade mobile-first.
