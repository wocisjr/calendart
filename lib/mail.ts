import nodemailer from "nodemailer";

type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export async function sendMail(payload: MailPayload) {
  const server = process.env.EMAIL_SERVER;
  const from = process.env.EMAIL_FROM;

  if (!server || !from) {
    return;
  }

  const transport = nodemailer.createTransport(server);

  await transport.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html
  });
}
