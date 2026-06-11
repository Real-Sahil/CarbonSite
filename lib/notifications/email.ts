import { Resend } from "resend";

type SendEmailParams = {
  to: string;
  subject: string;
  text: string;
};

export async function sendTransactionalEmail({ to, subject, text }: SendEmailParams) {
  const driver = process.env.EMAIL_DRIVER ?? "console";
  const from = process.env.EMAIL_FROM ?? "noreply@carbonsite.app";

  if (driver === "console") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Transactional email is not configured. Set EMAIL_DRIVER=resend in production.",
      );
    }
    console.log("[email:console]", { to, from, subject, text });
    return { provider: "console", messageId: null };
  }

  if (driver !== "resend") {
    throw new Error(`Unsupported EMAIL_DRIVER: ${driver}`);
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required when EMAIL_DRIVER=resend");
  }

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({ from, to, subject, text });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return { provider: "resend", messageId: result.data?.id ?? null };
}
