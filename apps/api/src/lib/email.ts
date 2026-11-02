import { Resend } from "resend";
import { env } from "../env";
import { logger } from "./logger";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

async function send(to: string, subject: string, html: string) {
  if (!resend) {
    // Sem chave do Resend (desenvolvimento): o link aparece no log.
    logger.info({ to, subject, html }, "E-mail (modo desenvolvimento)");
    return;
  }
  const { error } = await resend.emails.send({ from: env.EMAIL_FROM, to, subject, html });
  if (error) {
    logger.error({ err: error, to, subject, from: env.EMAIL_FROM }, `Falha ao enviar e-mail pelo Resend: ${error.message}`);
    // Fora de produção, o link continua acessível pelo log para não travar os testes.
    if (env.NODE_ENV !== "production") logger.info({ to, subject, html }, "E-mail (não enviado — conteúdo para teste)");
  }
}

const layout = (title: string, body: string, cta: { label: string; url: string }) => `
  <div style="font-family:Inter,Arial,sans-serif;background:#FAF7F2;padding:32px;color:#3D3A36">
    <div style="max-width:480px;margin:auto;background:#FFFDF9;border-radius:16px;padding:32px">
      <h1 style="font-family:Newsreader,Georgia,serif;font-weight:500">${title}</h1>
      <p>${body}</p>
      <p><a href="${cta.url}" style="display:inline-block;background:#A8C3A0;color:#3D3A36;padding:12px 20px;border-radius:12px;text-decoration:none">${cta.label}</a></p>
      <p style="color:#8A847B;font-size:13px">Se você não pediu isto, ignore este e-mail.</p>
    </div>
  </div>`;

export function sendVerificationEmail(to: string, name: string, token: string) {
  const url = `${env.WEB_ORIGIN}/confirmar-email?token=${encodeURIComponent(token)}`;
  return send(
    to,
    "Confirme seu e-mail no Compasso",
    layout(`Olá, ${name}`, "Falta só confirmar seu e-mail para começar a seguir sua agenda em ritmo.", {
      label: "Confirmar e-mail",
      url,
    }),
  );
}

export function sendPasswordResetEmail(to: string, name: string, token: string) {
  const url = `${env.WEB_ORIGIN}/redefinir-senha?token=${encodeURIComponent(token)}`;
  return send(
    to,
    "Redefinição de senha do Compasso",
    layout(`Olá, ${name}`, "Recebemos um pedido para redefinir sua senha. O link vale por 1 hora.", {
      label: "Redefinir senha",
      url,
    }),
  );
}
