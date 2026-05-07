import nodemailer from "nodemailer";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_MISSING`);
  return value;
}

function smtpPort() {
  const port = Number(process.env.SMTP_PORT ?? 587);
  return Number.isFinite(port) ? port : 587;
}

export async function sendRegistrationOtpEmail(email: string, code: string) {
  const port = smtpPort();
  const transporter = nodemailer.createTransport({
    host: requiredEnv("SMTP_HOST"),
    port,
    secure: port === 465,
    auth: {
      user: requiredEnv("SMTP_USER"),
      pass: requiredEnv("SMTP_PASS"),
    },
  });

  const from = process.env.SMTP_FROM?.trim() || requiredEnv("SMTP_USER");
  await transporter.sendMail({
    from,
    to: email,
    subject: "Ma OTP dang ky studio",
    text: `Ma OTP dang ky studio cua ban la ${code}. Ma co hieu luc trong 10 phut.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#3f241f">
        <h2>Ma OTP dang ky studio</h2>
        <p>Nhap ma sau de hoan tat tao studio:</p>
        <p style="font-size:28px;font-weight:800;letter-spacing:6px;color:#EA7188">${code}</p>
        <p>Ma co hieu luc trong 10 phut. Neu ban khong yeu cau ma nay, hay bo qua email.</p>
      </div>
    `,
  });
}
