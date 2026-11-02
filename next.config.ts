import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// ── Content-Security-Policy ────────────────────────────────────────────────
// Adjust sources as the project grows (e.g. add CDN hostnames to script-src).
const cspDirectives = [
  "default-src 'self'",
  // Scripts: self + inline + Google APIs + Stripe.js (payment forms)
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://accounts.google.com https://js.stripe.com",
  // Styles: self + inline (Next.js injects styles)
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Fonts
  "font-src 'self' https://fonts.gstatic.com",
  // Images: self + data URIs + Firebase Storage + Google avatars
  "img-src 'self' data: blob: https://storage.googleapis.com https://lh3.googleusercontent.com https://firebasestorage.googleapis.com",
  // Connections: self + Firebase + Google Auth + Google APIs + Stripe
  "connect-src 'self' https://*.googleapis.com https://apis.google.com https://accounts.google.com https://*.firebaseio.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.firebaseapp.com https://*.firebase.com https://api.stripe.com https://hooks.stripe.com",
  // Frames: Google Auth + Firebase Auth + Stripe Checkout iframes
  "frame-src https://accounts.google.com https://*.firebaseapp.com https://*.firebase.com https://js.stripe.com https://hooks.stripe.com",
  // Everything else: block
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(), payment=()",
  },
  // NOTE: Cross-Origin-Opener-Policy is NOT set here (default: unsafe-none).
  // Setting same-origin-allow-popups on ALL pages conflicts with Google's COOP: same-origin
  // header on the auth popup — Chrome would isolate the browsing context, making
  // window.opener null and breaking the Firebase signInWithPopup flow.
  // Pages that never open a Google auth popup (e.g. /crm/pagos, /portal/pagar) DO get
  // same-origin-allow-popups via the per-route header override below, which silences
  // the window.closed COOP warnings produced by Stripe's hosted checkout.
  {
    key: "Content-Security-Policy",
    value: cspDirectives,
  },
  // HSTS only in production to avoid breaking local dev
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

// Firebase Auth domain used to proxy /__/auth/* routes
// When authDomain is a custom domain (not project.firebaseapp.com), Firebase Auth's
// popup/iframe handler lives at /__/auth/. Without this proxy the browser gets 404
// because Next.js doesn't serve those paths.
const firebaseAuthDomain =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  reactStrictMode: true,
  async rewrites() {
    // Proxy Firebase Auth handler + iframe to the authoritative Firebase domain.
    // Required when authDomain is a custom domain so that signInWithPopup /
    // signInWithRedirect can load /__/auth/handler and /__/auth/iframe.
    const authRewrite = firebaseAuthDomain
      ? [
          {
            source: "/__/auth/:path*",
            destination: `https://${firebaseAuthDomain}/__/auth/:path*`,
          },
        ]
      : [];

    return [
      // Guia estática servida en guia.sanpedromotocare.com
      // Cuando el host es el subdominio de la guía, todas las rutas se sirven
      // desde /guia.html (incluye CSS+JS inline, sin dependencias).
      {
        has: [
          {
            type: "host",
            value: "guia.sanpedromotocare.com",
          },
        ],
        source: "/:path*",
        destination: "/guia.html",
      },
      ...authRewrite,
    ];
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // Payment pages never open a Google auth popup, so we can safely enable
        // same-origin-allow-popups. This lets our code (and Stripe.js) inspect
        // window.closed on popups we open, silencing the COOP console warnings.
        source: "/(crm/pagos|portal/pagar)(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
