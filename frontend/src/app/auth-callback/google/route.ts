// src/app/auth-callback/google/route.ts
import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "";
const GOOGLE_SITE_CLIENT_ID = process.env.GOOGLE_SITE_CLIENT_ID!;
const GOOGLE_SITE_CLIENT_SECRET = process.env.GOOGLE_SITE_CLIENT_SECRET!;
const REDIRECT_URI = "https://www.zygoflow.com/auth-callback/google";

// The core logic for handling the callback
async function handleGoogleCallback(req: NextRequest) {
  // If it's a POST request (form_post), we need to get data from formData
  // If it's a GET request, we get it from searchParams
  let code: string | null = null;
  let stateRaw: string | null = null;

  if (req.method === "POST") {
    const formData = await req.formData().catch(() => null);
    if (formData) {
      code = formData.get("code")?.toString() || null;
      stateRaw = formData.get("state")?.toString() || null;
    }
  } else {
    const { searchParams } = new URL(req.url);
    code = searchParams.get("code");
    stateRaw = searchParams.get("state");
  }

  if (!code || !stateRaw) {
    return NextResponse.redirect(
      "https://www.zygoflow.com?error=missing_params",
    );
  }

  let state: { subdomain: string; return_to: string };
  try {
    state = JSON.parse(stateRaw);
  } catch {
    return NextResponse.redirect(
      "https://www.zygoflow.com?error=invalid_state",
    );
  }

  const { subdomain, return_to } = state;

  try {
    // 1. Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_SITE_CLIENT_ID,
        client_secret: GOOGLE_SITE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("No access token");

    // 2. Get user info from Google
    const userRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      },
    );
    const googleUser = await userRes.json();

    // 3. Call your backend to create/find site member
    const backendRes = await fetch(
      `${API_BASE}/site-auth/${subdomain}/google-callback`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          google_id: googleUser.id,
          email: googleUser.email,
          name: googleUser.name,
        }),
      },
    );

    if (!backendRes.ok) throw new Error("Backend auth failed");
    const authData = await backendRes.json();

    // 4. Redirect back to the site with token AND the exact subdomain parameter
    const isCustomDomain =
      return_to && !return_to.includes("zygoflow.com") && return_to !== "";

    let redirectUrl: string;

    if (isCustomDomain) {
      const base = return_to.startsWith("http")
        ? return_to
        : `https://${return_to}`;
      redirectUrl = `${base}/auth/callback?token=${authData.access_token}&member_id=${authData.member_id}&email=${encodeURIComponent(authData.email)}&subdomain=${subdomain}`;
    } else {
      redirectUrl = `https://www.zygoflow.com/${subdomain}/auth/callback?token=${authData.access_token}&member_id=${authData.member_id}&email=${encodeURIComponent(authData.email)}&subdomain=${subdomain}`;
    }

    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error("Google callback error:", err);
    return NextResponse.redirect(
      `https://www.zygoflow.com/${subdomain}?error=auth_failed`,
    );
  }
}

// EXPORT BOTH GET AND POST HANDLERS!
export async function GET(req: NextRequest) {
  return handleGoogleCallback(req);
}

export async function POST(req: NextRequest) {
  return handleGoogleCallback(req);
}
