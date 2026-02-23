/**
 * HTML Email Template Builder
 * Generates inline-CSS email for multi-client compatibility (Gmail, Outlook, Apple Mail).
 * Designed for FUB Action Plan delivery.
 */

interface EmailTemplateData {
  listingAddress: string;
  sellerName?: string;
  agentName?: string;
  agentPhone?: string;
  agentEmail?: string;
  agentPhotoUrl?: string;
  weeklyNarrative?: string;
  totalImpressions?: number;
  totalVideoViews?: number;
  totalPortalViews?: number;
  totalShowings?: number;
  magicLinkUrl: string;
  pdfUrl?: string;
  logoUrl?: string;
}

export function buildWeeklyEmailHtml(data: EmailTemplateData): string {
  const {
    listingAddress,
    sellerName,
    agentName,
    agentPhone,
    agentEmail,
    agentPhotoUrl,
    weeklyNarrative,
    totalImpressions = 0,
    totalVideoViews = 0,
    totalPortalViews = 0,
    totalShowings = 0,
    magicLinkUrl,
    pdfUrl,
    logoUrl,
  } = data;

  const greeting = sellerName ? `Hi ${sellerName},` : "Hi there,";
  const narrative = weeklyNarrative || "We've been working hard to market your property this week. Click below to see your full marketing report.";

  const formatNum = (n: number) => n.toLocaleString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Weekly Marketing Report — ${listingAddress}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f0f0;font-family:'Sansita',Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f0f0;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <!-- Email Container -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(42,56,76,0.12);">

          <!-- Header -->
          <tr>
            <td style="background-color:#2A384C;padding:32px 40px;text-align:center;">
              ${logoUrl
                ? `<img src="${logoUrl}" alt="Home Grown Property Group" style="height:60px;max-width:280px;display:block;margin:0 auto;" />`
                : `<h1 style="margin:0;color:#F0F0F0;font-family:'Cooper Hewitt','Trebuchet MS',sans-serif;font-size:22px;letter-spacing:0.08em;font-weight:600;">HOME GROWN</h1>
                   <p style="margin:4px 0 0;color:#A0B2C2;font-family:'Cooper Hewitt','Trebuchet MS',sans-serif;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;">PROPERTY GROUP</p>`
              }
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:32px 40px 16px;text-align:center;border-bottom:1px solid #D1D9DF;">
              <p style="margin:0 0 8px;color:#A0B2C2;font-family:'Cooper Hewitt','Trebuchet MS',sans-serif;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;">YOUR WEEKLY MARKETING REPORT</p>
              <h2 style="margin:0;color:#2A384C;font-family:'Cooper Hewitt','Trebuchet MS',sans-serif;font-size:20px;font-weight:600;">${listingAddress}</h2>
            </td>
          </tr>

          <!-- Stats Row -->
          <tr>
            <td style="padding:28px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="25%" style="text-align:center;padding:0 8px;">
                    <div style="background-color:#f5f7f9;border-radius:8px;padding:16px 8px;border:1px solid #D1D9DF;">
                      <p style="margin:0;color:#2A384C;font-family:'Cooper Hewitt','Trebuchet MS',sans-serif;font-size:22px;font-weight:700;">${formatNum(totalImpressions)}</p>
                      <p style="margin:4px 0 0;color:#A0B2C2;font-family:'Cooper Hewitt','Trebuchet MS',sans-serif;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;">Impressions</p>
                    </div>
                  </td>
                  <td width="25%" style="text-align:center;padding:0 8px;">
                    <div style="background-color:#f5f7f9;border-radius:8px;padding:16px 8px;border:1px solid #D1D9DF;">
                      <p style="margin:0;color:#2A384C;font-family:'Cooper Hewitt','Trebuchet MS',sans-serif;font-size:22px;font-weight:700;">${formatNum(totalVideoViews)}</p>
                      <p style="margin:4px 0 0;color:#A0B2C2;font-family:'Cooper Hewitt','Trebuchet MS',sans-serif;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;">Video Views</p>
                    </div>
                  </td>
                  <td width="25%" style="text-align:center;padding:0 8px;">
                    <div style="background-color:#f5f7f9;border-radius:8px;padding:16px 8px;border:1px solid #D1D9DF;">
                      <p style="margin:0;color:#2A384C;font-family:'Cooper Hewitt','Trebuchet MS',sans-serif;font-size:22px;font-weight:700;">${formatNum(totalPortalViews)}</p>
                      <p style="margin:4px 0 0;color:#A0B2C2;font-family:'Cooper Hewitt','Trebuchet MS',sans-serif;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;">Portal Views</p>
                    </div>
                  </td>
                  <td width="25%" style="text-align:center;padding:0 8px;">
                    <div style="background-color:#f5f7f9;border-radius:8px;padding:16px 8px;border:1px solid #D1D9DF;">
                      <p style="margin:0;color:#2A384C;font-family:'Cooper Hewitt','Trebuchet MS',sans-serif;font-size:22px;font-weight:700;">${formatNum(totalShowings)}</p>
                      <p style="margin:4px 0 0;color:#A0B2C2;font-family:'Cooper Hewitt','Trebuchet MS',sans-serif;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;">Showings</p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Agent Narrative -->
          <tr>
            <td style="padding:0 40px 28px;">
              <p style="margin:0 0 8px;color:#A0B2C2;font-family:'Cooper Hewitt','Trebuchet MS',sans-serif;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;">A NOTE FROM YOUR AGENT</p>
              <p style="margin:0;color:#2A384C;font-family:'Sansita',Georgia,serif;font-size:15px;line-height:1.6;">${narrative}</p>
            </td>
          </tr>

          <!-- CTA Buttons -->
          <tr>
            <td style="padding:0 40px 32px;text-align:center;">
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                <tr>
                  <td style="padding:0 8px 12px;">
                    <a href="${magicLinkUrl}" style="display:inline-block;background-color:#2A384C;color:#F0F0F0;font-family:'Cooper Hewitt','Trebuchet MS',sans-serif;font-size:13px;font-weight:600;letter-spacing:0.08em;text-decoration:none;padding:14px 28px;border-radius:6px;">VIEW YOUR FULL REPORT →</a>
                  </td>
                </tr>
                ${pdfUrl ? `<tr>
                  <td style="padding:0 8px;text-align:center;">
                    <a href="${pdfUrl}" style="display:inline-block;color:#A0B2C2;font-family:'Sansita',Georgia,serif;font-size:13px;text-decoration:underline;">Download This Week's Report Card (PDF)</a>
                  </td>
                </tr>` : ""}
              </table>
            </td>
          </tr>

          <!-- Agent Footer -->
          <tr>
            <td style="background-color:#f5f7f9;padding:24px 40px;border-top:1px solid #D1D9DF;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="56" style="vertical-align:top;">
                    ${agentPhotoUrl
                      ? `<img src="${agentPhotoUrl}" alt="${agentName ?? "Agent"}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;display:block;" />`
                      : `<div style="width:48px;height:48px;border-radius:50%;background-color:#A0B2C2;display:flex;align-items:center;justify-content:center;"></div>`
                    }
                  </td>
                  <td style="padding-left:12px;vertical-align:top;">
                    <p style="margin:0;color:#2A384C;font-family:'Cooper Hewitt','Trebuchet MS',sans-serif;font-size:14px;font-weight:600;">${agentName ?? "Your Agent"}</p>
                    <p style="margin:2px 0 0;color:#A0B2C2;font-family:'Sansita',Georgia,serif;font-size:12px;">Home Grown Property Group | Real Broker, LLC</p>
                    ${agentPhone ? `<p style="margin:2px 0 0;color:#2A384C;font-family:'Sansita',Georgia,serif;font-size:12px;">${agentPhone}</p>` : ""}
                    ${agentEmail ? `<p style="margin:2px 0 0;"><a href="mailto:${agentEmail}" style="color:#A0B2C2;font-family:'Sansita',Georgia,serif;font-size:12px;text-decoration:none;">${agentEmail}</a></p>` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#2A384C;padding:16px 40px;text-align:center;">
              <p style="margin:0;color:#A0B2C2;font-family:'Sansita',Georgia,serif;font-size:11px;">Questions? Reply directly to this email.</p>
              <p style="margin:4px 0 0;color:rgba(160,178,194,0.5);font-family:'Sansita',Georgia,serif;font-size:10px;">© ${new Date().getFullYear()} Home Grown Property Group | Real Broker, LLC</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
