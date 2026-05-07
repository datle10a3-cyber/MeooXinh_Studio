import nodemailer from "nodemailer";

type SendEmailResult = {
  ok: boolean;
  reason?: "SMTP_CONFIG_MISSING" | "SMTP_SEND_FAILED";
};

function envValue(name: string) {
  return process.env[name]?.trim() ?? "";
}

function smtpPort() {
  const port = Number(process.env.SMTP_PORT ?? 587);
  return Number.isFinite(port) ? port : 587;
}

function smtpConfig() {
  const host = envValue("SMTP_HOST");
  const user = envValue("SMTP_USER");
  const pass = envValue("SMTP_PASS");
  if (!host || !user || !pass) {
    console.warn("SMTP is not configured. OTP email was not sent.");
    return null;
  }
  return {
    host,
    user,
    pass,
    port: smtpPort(),
    from: envValue("SMTP_FROM") || user,
  };
}

async function sendOtpEmail(input: { email: string; code: string; subject: string; heading: string; intro: string }): Promise<SendEmailResult> {
  const config = smtpConfig();
  if (!config) return { ok: false, reason: "SMTP_CONFIG_MISSING" };

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

    await transporter.sendMail({
      from: config.from,
      to: input.email,
      subject: input.subject,
      text: `${input.heading}: ${input.code}. Ma co hieu luc trong 10 phut.`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#3f241f">
          <h2>${input.heading}</h2>
          <p>${input.intro}</p>
          <p style="font-size:28px;font-weight:800;letter-spacing:6px;color:#EA7188">${input.code}</p>
          <p>Ma co hieu luc trong 10 phut. Neu ban khong yeu cau ma nay, hay bo qua email.</p>
        </div>
      `,
    });
    return { ok: true };
  } catch (error) {
    console.warn("Failed to send OTP email.", error);
    return { ok: false, reason: "SMTP_SEND_FAILED" };
  }
}

export async function sendRegistrationOtpEmail(email: string, code: string): Promise<SendEmailResult> {
  return sendOtpEmail({
    email,
    code,
    subject: "Ma OTP dang ky studio",
    heading: "Ma OTP dang ky studio",
    intro: "Nhap ma sau de hoan tat tao studio:",
  });
}

export async function sendPasswordResetOtpEmail(email: string, code: string): Promise<SendEmailResult> {
  return sendOtpEmail({
    email,
    code,
    subject: "Ma OTP dat lai mat khau",
    heading: "Ma OTP dat lai mat khau",
    intro: "Nhap ma sau de dat lai mat khau tai khoan studio:",
  });
}
