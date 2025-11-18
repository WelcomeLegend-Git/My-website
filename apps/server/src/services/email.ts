import nodemailer from "nodemailer";
import { env } from "../env";
import { logger } from "../logger";

type PasswordResetEmailInput = {
  to: string;
  code: string;
  expiresInMinutes: number;
};

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST || "smtp.gmail.com",
  port: env.SMTP_PORT || 587,
  secure: false,
  auth:
    env.SMTP_USER && env.SMTP_PASS
      ? {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        }
      : undefined,
});

export const sendPasswordResetEmail = async (input: PasswordResetEmailInput) => {
  if (!env.SMTP_USER || !env.SMTP_PASS || !env.EMAIL_FROM) {
    throw new Error("Password reset email is not configured on the server");
  }

  const subject = "Reset your Study Guru password";
  const text = `Your password reset code is: ${input.code}\n\nThis code will expire in ${input.expiresInMinutes} minutes. If you did not request this, you can ignore this email.`;

  try {
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: input.to,
      subject,
      text,
    });
    logger.info({ to: input.to }, "Password reset email sent");
  } catch (error) {
    logger.error({ error, to: input.to }, "Failed to send password reset email");
    throw error;
  }
};
