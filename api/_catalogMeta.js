// Cópia mínima (id + slugs de cor + tamanhos) do catálogo real, usada só
// pela ação "definir estoque para todos os produtos". Existe separada de
// src/data/products.js de propósito: importar aquele arquivo (que puxa
// utils/format.js) de dentro de uma função em /api causou falha de rota
// na Vercel (a função parava de responder por completo) - importar só o
// necessário, sem sair da pasta api/, evita esse problema.
// Mantenha em sincronia com src/data/products.js se uma cor/tamanho for
// adicionado ou removido lá.
export const catalogMeta = [
  { id: 'gt-001', colors: ['azulroyal', 'bege', 'bordo', 'branca', 'cinzamescla', 'marinho', 'marrom', 'preta', 'rosa', 'verdeescuro', 'vermelho'], sizes: ['P', 'M', 'G', 'GG'] },
  { id: 'gt-002', colors: ['preto', 'branco', 'cinza', 'lilas', 'rosa'], sizes: ['P', 'M', 'G', 'GG'] },
  { id: 'gt-003', colors: ['branca', 'preta'], sizes: ['P', 'M', 'G', 'GG'] },
  { id: 'gt-004', colors: ['branca', 'preta', 'rosa'], sizes: ['PP', 'P', 'M', 'G', 'GG'] },
  { id: 'gt-005', colors: ['bege', 'bordo', 'branco', 'cinzamescla', 'marinho', 'preto', 'rosa'], sizes: ['P', 'M', 'G', 'GG'] },
  { id: 'gt-006', colors: ['marinho', 'preto'], sizes: ['P', 'M', 'G', 'GG'] },
];
