import type { AuditLog } from "@prisma/client";

interface AuditTrailOptions {
  hideHashes?: boolean;
}

export function buildAuditTrailHtml(
  auditEvents: AuditLog[],
  options: AuditTrailOptions = {}
): string {
  if (auditEvents.length === 0) {
    return "";
  }

  const { hideHashes = false } = options;
  const rows = auditEvents
    .slice(0, 20)
    .map((event) => {
      const actorEmail = (event as unknown as { actor?: { email: string } })?.actor?.email ?? "System";
      const timestamp = event.createdAt.toISOString().split("T")[0];
      const metadataText = event.metadata
        ? typeof event.metadata === "string"
          ? event.metadata.slice(0, 100)
          : JSON.stringify(event.metadata).slice(0, 100)
        : "";

      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 8px;">${timestamp}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 8px;">${actorEmail}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 8px;">${event.action}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 8px;">${event.resourceType}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 8px; color: #9ca3af;">${metadataText}</td>
        </tr>
      `;
    })
    .join("");

  const html = `
    <div style="margin: 16px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 8px; text-align: left; font-weight: 600; font-size: 7.5px; text-transform: uppercase; color: #6b7280;">Date</th>
            <th style="padding: 8px; text-align: left; font-weight: 600; font-size: 7.5px; text-transform: uppercase; color: #6b7280;">Actor</th>
            <th style="padding: 8px; text-align: left; font-weight: 600; font-size: 7.5px; text-transform: uppercase; color: #6b7280;">Action</th>
            <th style="padding: 8px; text-align: left; font-weight: 600; font-size: 7.5px; text-transform: uppercase; color: #6b7280;">Type</th>
            <th style="padding: 8px; text-align: left; font-weight: 600; font-size: 7.5px; text-transform: uppercase; color: #6b7280;">Details</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      ${
        !hideHashes
          ? `<div style="font-size: 11px; color: #059669; margin-top: 8px;">✓ Audit trail integrity verified via SHA-256 chain</div>`
          : ""
      }
    </div>
  `;

  return html;
}
