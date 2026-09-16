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

## Painel de Pedidos e PDV (venda no balcão)

Duas telas internas, separadas da loja e não linkadas no menu público:

- **`/admin.html`** — Painel de pedidos: lista todos os pedidos (loja online + PDV), com filtros por status/canal/busca, cartões de resumo (faturamento, ticket médio, pedidos do dia) e uma tela de detalhe onde dá pra marcar o pedido como Pago / Aguardando / Cancelado.
- **`/pdv.html`** — Frente de caixa (PDV) para vendas no balcão: catálogo com todas as cores/tamanhos reais, carrinho da venda, desconto manual em R$, e três formas de pagamento: **Dinheiro**, **Cartão (maquininha)** — registra a venda como paga na hora — ou **Pix/Cartão via InfinitePay** — gera um link/cobrança real pela mesma integração do checkout, para o cliente pagar pelo celular no balcão.

Acesso protegido por um **PIN local** (`2026`, definido em `src/admin/adminAuth.js`) — é só uma trava simples, não uma autenticação de servidor de verdade.

**Importante sobre os dados**: painel e PDV leem os pedidos do mesmo `localStorage` da loja. Isso significa que, hoje, cada computador/navegador só vê os pedidos feitos nele mesmo — não existe um banco de dados central compartilhando pedidos entre o caixa da loja e os clientes online em outros dispositivos. Para isso funcionar de verdade com múltiplos pontos de venda e clientes reais, é necessário um backend com banco de dados compartilhado no lugar do `localStorage`.

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
