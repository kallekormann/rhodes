export type MailConfig = {
  host: string;
  port: number;
  from: string;
  senderName: string;
};

export function getMailConfig(): MailConfig | null {
  const rawHost = process.env.SMTP_HOST?.trim();
  if (!rawHost) return null;

  const host = rawHost === "mailpit" ? "127.0.0.1" : rawHost;
  const port = Number(process.env.SMTP_PORT ?? "1026");
  const from = process.env.SMTP_FROM?.trim() || "dev@rhodes.local";
  const senderName = process.env.SMTP_SENDER_NAME?.trim() || "Rhodes";

  return { host, port, from, senderName };
}
