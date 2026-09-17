// Envio de e-mail via API REST do Resend (https://resend.com) - sem SDK,
// só fetch, pra não adicionar dependência nova. Precisa da variável de
// ambiente RESEND_API_KEY configurada na Vercel. Sem domínio próprio
// verificado no Resend, o remetente usa o domínio de testes deles
// (onboarding@resend.dev) - funciona para o plano gratuito; para usar um
// e-mail próprio (ex. contato@gratitudetextil.com.br) é preciso verificar
// o domínio no painel do Resend e trocar FROM_EMAIL abaixo.
const FROM_EMAIL = 'Gratitude Têxtil <onboarding@resend.dev>';

export async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY não configurado nas variáveis de ambiente da Vercel.');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Falha ao enviar e-mail (${res.status}): ${detail}`);
  }
}
