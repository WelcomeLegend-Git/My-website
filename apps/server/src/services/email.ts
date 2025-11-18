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
  if (!env.EMAIL_FROM) {
    throw new Error("Password reset email is not configured on the server");
  }

  const subject = "Reset your Study Guru password";
  const text = `Your password reset code is: ${input.code}\n\nThis code will expire in ${input.expiresInMinutes} minutes. If you did not request this, you can ignore this email.`;

  // Prefer Resend when configured (e.g. in production on Render)
  if (env.RESEND_API_KEY) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: input.to,
          subject,
          text,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        logger.error(
          { status: response.status, body, to: input.to },
          "Resend email API call failed",
        );
        throw new Error(`Resend responded with status ${response.status}`);
      }

      logger.info({ to: input.to }, "Password reset email sent via Resend");
      return;
    } catch (error) {
      logger.error({ error, to: input.to }, "Failed to send password reset email via Resend");
      throw error;
    }
  }

  // Fallback: use SMTP via Nodemailer (for local development or when RESEND_API_KEY is not set)
  if (!env.SMTP_USER || !env.SMTP_PASS) {
    throw new Error("Password reset email is not configured on the server");
  }

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
