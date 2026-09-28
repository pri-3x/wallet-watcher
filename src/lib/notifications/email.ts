export type Signal = {
  address: string;
  detail: string;
  link?: string;
};

/** Payloads are stored as one line of text plus an optional explorer URL. */
export function parseSignal(payload: string): Signal {
  const [body = "", link = ""] = payload.split("\n");
  const sep = body.indexOf(" · ");
  const address = (sep === -1 ? body : body.slice(0, sep)).trim();
  const detail = sep === -1 ? "" : body.slice(sep + 3).trim();
  const href = link.trim();
  return { address, detail, link: href || undefined };
}

export function emailSubject(signal: Signal) {
  const subject = signal.detail ? `${signal.address} · ${signal.detail}` : "A watched wallet moved";
  return subject.length > 90 ? `${subject.slice(0, 87)}…` : subject;
}

export function emailText(signal: Signal) {
  const lines = ["Wallet Watch", "", "A watched wallet moved", "", signal.address];
  if (signal.detail) lines.push(signal.detail);
  if (signal.link) lines.push("", signal.link);
  return lines.join("\n");
}

export function emailHtml(signal: Signal) {
  const address = escapeHtml(signal.address);
  const detail = escapeHtml(signal.detail);
  const link = signal.link ? escapeHtml(signal.link) : "";
  const action = signal.link?.includes("/tx/") ? "View the transaction" : "View the wallet";

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0c0c0b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c0c0b;">
    <tr>
      <td align="center" style="padding:48px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;">
          <tr>
            <td style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6e6a62;">Wallet Watch</td>
          </tr>
          <tr>
            <td style="padding:18px 0 28px;font-family:ui-sans-serif,system-ui,sans-serif;font-size:32px;line-height:1.1;letter-spacing:-0.03em;color:#f3f1ea;">A watched wallet moved.</td>
          </tr>
          <tr>
            <td style="border-top:1px solid #2a2926;padding-top:22px;font-family:ui-monospace,monospace;font-size:14px;color:#c6a15a;">${address}</td>
          </tr>
          ${
            detail
              ? `<tr><td style="padding-top:10px;font-family:ui-sans-serif,system-ui,sans-serif;font-size:16px;line-height:1.45;color:#f3f1ea;">${detail}</td></tr>`
              : ""
          }
          ${
            link
              ? `<tr><td style="padding-top:28px;"><a href="${link}" style="display:inline-block;background:#f3f1ea;color:#0c0c0b;font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;line-height:1;text-decoration:none;padding:14px 18px;">${action}</a></td></tr>`
              : ""
          }
          <tr>
            <td style="padding-top:36px;font-family:ui-sans-serif,system-ui,sans-serif;font-size:12px;color:#6e6a62;">Sent because this wallet is on your desk.</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
