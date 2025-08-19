// lib/publicUrl.ts
export function buildPublicUrl(opts: {
  subdomain: string;
  slug?: string; // e.g. "/about"
  primaryDomain?: string | null; // e.g. "their-domain.com"
  primaryDomainVerified?: boolean;
}) {
  const slug = opts.slug && opts.slug !== "/" ? opts.slug : "/";
  const APP_ORIGIN =
    process.env.NEXT_PUBLIC_APP_ORIGIN?.replace(/\/$/, "") ||
    "https://www.zygoflow.com";

  if (opts.primaryDomain && opts.primaryDomainVerified) {
    return `https://${opts.primaryDomain}${slug}`;
  }
  // fallback to main host /<subdomain>/...
  return `${APP_ORIGIN}/${opts.subdomain}${slug}`;
}
