// mail.js
// KLE Inter College Hackathon 2K26
// Email service using Resend API

const RESEND_URL = "https://api.resend.com/emails";

// --------------------------------------------------
// Environment validation
// --------------------------------------------------

function getConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY in environment variables.");
  }

  if (!from) {
    throw new Error("Missing MAIL_FROM in environment variables.");
  }

  return {
    apiKey,
    from,
  };
}

// --------------------------------------------------
// HTML escaping
// --------------------------------------------------

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return map[char];
  });
}

// --------------------------------------------------
// Email HTML design
// --------------------------------------------------

function emailShell(body) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KLE Inter College Hackathon 2K26</title>
</head>

<body style="
  margin:0;
  padding:30px 10px;
  background:#f4f7fb;
  font-family:Arial,Helvetica,sans-serif;
">

  <div style="
    max-width:500px;
    margin:auto;
    background:#ffffff;
    border-radius:16px;
    overflow:hidden;
    box-shadow:0 5px 25px rgba(0,0,0,0.08);
  ">

    <div style="
      background:#0c0a26;
      padding:25px;
      text-align:center;
    ">

      <h1 style="
        margin:0;
        color:#19e6ff;
        font-size:22px;
      ">
        KLE Inter College Hackathon 2K26
      </h1>

      <p style="
        margin:8px 0 0;
        color:#ffffff;
        font-size:14px;
      ">
        Participant Portal
      </p>

    </div>

    <div style="
      padding:30px;
      color:#222222;
    ">
      ${body}
    </div>

    <div style="
      padding:18px;
      text-align:center;
      background:#f7f8fc;
      color:#777777;
      font-size:12px;
    ">
      © 2026 KLE Inter College Hackathon 2K26
    </div>

  </div>

</body>
</html>
`;
}

// --------------------------------------------------
// Send email using Resend
// --------------------------------------------------

async function sendEmail({ to, subject, text, html }) {
  const { apiKey, from } = getConfig();

  const recipients = Array.isArray(to) ? to : [to];

  if (!recipients.length) {
    throw new Error("No recipient email address provided.");
  }

  const cleanRecipients = recipients
    .map((email) => String(email).trim())
    .filter(Boolean);

  if (!cleanRecipients.length) {
    throw new Error("Recipient email address is empty.");
  }

  console.log("📧 Sending email...");
  console.log("From:", from);
  console.log("To:", cleanRecipients);
  console.log("Subject:", subject);

  const response = await fetch(RESEND_URL, {
    method: "POST",

    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      from,
      to: cleanRecipients,
      subject,
      text,
      html,
    }),
  });

  const responseText = await response.text();

  let result;

  try {
    result = JSON.parse(responseText);
  } catch {
    result = {
      raw: responseText,
    };
  }

  if (!response.ok) {
    console.error("❌ Resend API error:");
    console.error("Status:", response.status);
    console.error("Response:", result);

    throw new Error(
      `Resend email failed (${response.status}): ${
        result?.message ||
        result?.error ||
        result?.raw ||
        "Unknown Resend error"
      }`
    );
  }

  console.log("✅ Email sent successfully");
  console.log("Resend response:", result);

  return result;
}

// --------------------------------------------------
// Send OTP
// --------------------------------------------------

async function sendOtp(user, code) {
  if (!user || !user.email) {
    throw new Error("User email is missing.");
  }

  if (!code) {
    throw new Error("OTP code is missing.");
  }

  const name = escapeHtml(user.name || "Participant");
  const otp = escapeHtml(code);

  const subject = `${code} is your KLE Hackathon 2K26 verification code`;

  const text = `
Hi ${user.name || "Participant"},

Your KLE Inter College Hackathon 2K26 verification code is:

${code}

This code expires in 10 minutes.

If you did not create this account, please ignore this email.

KLE Inter College Hackathon 2K26
`;

  const html = emailShell(`
    <h2 style="
      margin-top:0;
      color:#111827;
    ">
      Verify your email
    </h2>

    <p>
      Hi <strong>${name}</strong>,
    </p>

    <p>
      Use the following 6-digit code to verify your email:
    </p>

    <div style="
      margin:25px 0;
      padding:20px;
      background:#0c0a26;
      border-radius:12px;
      text-align:center;
    ">

      <div style="
        font-size:36px;
        letter-spacing:10px;
        font-weight:bold;
        color:#19e6ff;
      ">
        ${otp}
      </div>

    </div>

    <p>
      This code expires in <strong>10 minutes</strong>.
    </p>

    <p style="
      color:#777777;
      font-size:13px;
    ">
      If you did not create this account, you can safely ignore this email.
    </p>
  `);

  return await sendEmail({
    to: user.email,
    subject,
    text,
    html,
  });
}

// --------------------------------------------------
// Test email
// --------------------------------------------------

async function sendTestEmail(to) {
  const text = `
KLE Inter College Hackathon 2K26

Email delivery is configured successfully.

This is a test email.
`;

  const html = emailShell(`
    <h2>Email Test Successful ✅</h2>

    <p>
      Your KLE Inter College Hackathon 2K26 email system
      is configured correctly.
    </p>

    <p>
      Resend API is working successfully.
    </p>
  `);

  return await sendEmail({
    to,
    subject: "KLE Hackathon 2K26 - Email Test",
    text,
    html,
  });
}

// --------------------------------------------------
// Registration confirmation
// --------------------------------------------------

async function sendConfirmation(team) {
  if (!team) {
    throw new Error("Team information is missing.");
  }

  if (!team.leader || !team.leader.email) {
    throw new Error("Team leader email is missing.");
  }

  const leaderName = escapeHtml(team.leader.name || "Participant");
  const teamName = escapeHtml(team.name || "Your Team");
  const domain = escapeHtml(team.domain || "Hackathon");

  const recipients = [
    team.leader.email,
    ...(team.members || []).map((member) => member.email),
  ].filter(Boolean);

  const subject =
    "Registration received: KLE Inter College Hackathon 2K26";

  const text = `
Hi ${team.leader.name || "Participant"},

Your team "${team.name}" has been registered successfully.

Domain:
${team.domain}

Status:
Pending

Kickoff:
10 Oct 2026, 11:00 AM

First judging:
10 Oct 2026, 6:00 PM

Finals and results:
11 Oct 2026, 9:00 PM

Log in to the Participant Portal to track your approval status.

KLE Inter College Hackathon 2K26
`;

  const html = emailShell(`
    <h2>
      Registration Received ✅
    </h2>

    <p>
      Hi <strong>${leaderName}</strong>,
    </p>

    <p>
      Your team
      <strong>${teamName}</strong>
      has been registered successfully.
    </p>

    <div style="
      background:#f4f7fb;
      padding:18px;
      border-radius:10px;
      margin:20px 0;
    ">

      <p>
        <strong>Domain:</strong> ${domain}
      </p>

      <p>
        <strong>Status:</strong> Pending
      </p>

      <p>
        <strong>Kickoff:</strong>
        10 Oct 2026, 11:00 AM
      </p>

      <p>
        <strong>First judging:</strong>
        10 Oct 2026, 6:00 PM
      </p>

      <p>
        <strong>Finals and results:</strong>
        11 Oct 2026, 9:00 PM
      </p>

    </div>

    <p>
      Log in to the Participant Portal to track your approval status.
    </p>
  `);

  try {
    return await sendEmail({
      to: recipients,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error("❌ Confirmation email failed:", error.message);
    throw error;
  }
}

// --------------------------------------------------
// Export
// --------------------------------------------------

module.exports = {
  sendEmail,
  sendOtp,
  sendConfirmation,
  sendTestEmail,
};
