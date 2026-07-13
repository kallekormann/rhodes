import nodemailer from "nodemailer";
import type { AssignableTeamRole } from "@rhodes/shared/team-roles";
import { TEAM_ROLE_LABELS } from "@rhodes/shared/team-roles";
import { getMailConfig } from "./config";

export type TeamInviteEmailInput = {
  to: string;
  inviteUrl: string;
  scopeName: string;
  inviterName: string;
  role: AssignableTeamRole;
};

function formatFromAddress(from: string, senderName: string) {
  return `${senderName} <${from}>`;
}

export async function sendTeamInviteEmail(input: TeamInviteEmailInput): Promise<void> {
  const config = getMailConfig();
  if (!config) {
    throw new Error("SMTP is not configured (set SMTP_HOST in apps/web/.env.local)");
  }

  const roleLabel = TEAM_ROLE_LABELS[input.role];
  const subject = `Join ${input.scopeName} on Rhodes`;
  const text = [
    `${input.inviterName} invited you to join the team scope "${input.scopeName}" as ${roleLabel}.`,
    "",
    `Accept the invite: ${input.inviteUrl}`,
    "",
    "This link expires in 7 days.",
  ].join("\n");

  const html = `
    <p><strong>${escapeHtml(input.inviterName)}</strong> invited you to join the team scope <strong>${escapeHtml(input.scopeName)}</strong> as ${roleLabel}.</p>
    <p><a href="${escapeHtml(input.inviteUrl)}">Accept invite</a></p>
    <p style="color:#666;font-size:13px;">This link expires in 7 days.</p>
  `.trim();

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false,
    ignoreTLS: true,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });

  await transport.sendMail({
    from: formatFromAddress(config.from, config.senderName),
    to: input.to,
    subject,
    text,
    html,
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
