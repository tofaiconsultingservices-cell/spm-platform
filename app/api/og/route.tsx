/**
 * GET /api/og
 *
 * Dynamic Open Graph image — 1200×630px.
 * Used by WhatsApp, Messenger, Twitter, LinkedIn, and all social platforms
 * when the URL is shared. Returns a properly-sized banner with the
 * SanPedroMotoCare brand identity.
 *
 * Query params:
 *   title?       — Custom title (default: "Mecánico Certificado a Domicilio")
 *   description? — Custom description
 */

import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const title = searchParams.get("title")       ?? "Mecánico Certificado a Domicilio";
  const desc  = searchParams.get("description") ?? "Servicio a domicilio en San Pedro Garza García y Monterrey. Respuesta en 45 min.";

  // Load the logo image as a data URL for embedding
  const logoUrl = new URL("/images/logo.png", req.url).toString();

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "1200px",
          height: "630px",
          background: "linear-gradient(135deg, #0D1B3E 0%, #0F172A 40%, #071428 100%)",
          fontFamily: "system-ui, sans-serif",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Blue glow top-left */}
        <div
          style={{
            position: "absolute",
            top: "-120px",
            left: "-80px",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(29,78,216,0.35) 0%, transparent 70%)",
          }}
        />
        {/* Green glow bottom-right */}
        <div
          style={{
            position: "absolute",
            bottom: "-100px",
            right: "-60px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(22,163,74,0.25) 0%, transparent 70%)",
          }}
        />

        {/* Left: Logo + Brand */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            padding: "64px 56px",
            width: "560px",
            zIndex: 1,
          }}
        >
          {/* Logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            width={180}
            height={180}
            style={{ objectFit: "contain", marginBottom: "24px" }}
            alt="Logo"
          />

          {/* Brand name */}
          <div style={{ display: "flex", flexDirection: "column", marginBottom: "20px" }}>
            <span
              style={{
                fontSize: "52px",
                fontWeight: 900,
                color: "#FFFFFF",
                lineHeight: 1.1,
                letterSpacing: "-1px",
              }}
            >
              SanPedro
              <span style={{ color: "#3B82F6" }}>MotoCare</span>
            </span>
          </div>

          {/* Divider */}
          <div
            style={{
              width: "60px",
              height: "4px",
              borderRadius: "2px",
              background: "linear-gradient(90deg, #1D4ED8, #16A34A)",
              marginBottom: "20px",
            }}
          />

          {/* Title */}
          <span
            style={{
              fontSize: "26px",
              fontWeight: 600,
              color: "#E2E8F0",
              lineHeight: 1.3,
              marginBottom: "12px",
            }}
          >
            {title}
          </span>

          {/* Description */}
          <span
            style={{
              fontSize: "18px",
              color: "#94A3B8",
              lineHeight: 1.5,
            }}
          >
            {desc}
          </span>
        </div>

        {/* Right: Stats panel */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            padding: "64px 56px 64px 40px",
            flex: 1,
            gap: "20px",
            zIndex: 1,
          }}
        >
          {[
            { icon: "🏍️", value: "500+", label: "Servicios realizados" },
            { icon: "⚡", value: "45 min", label: "Tiempo de respuesta" },
            { icon: "⭐", value: "98%", label: "Satisfacción del cliente" },
            { icon: "📍", value: "8+ zonas", label: "San Pedro · MTY · GDL" },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "16px",
                padding: "16px 24px",
                width: "100%",
              }}
            >
              <span style={{ fontSize: "28px" }}>{stat.icon}</span>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "22px", fontWeight: 700, color: "#FFFFFF" }}>
                  {stat.value}
                </span>
                <span style={{ fontSize: "13px", color: "#94A3B8" }}>{stat.label}</span>
              </div>
            </div>
          ))}

          {/* URL badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginTop: "8px",
              background: "rgba(29,78,216,0.2)",
              border: "1px solid rgba(29,78,216,0.4)",
              borderRadius: "999px",
              padding: "10px 20px",
            }}
          >
            <span style={{ fontSize: "14px", color: "#93C5FD", fontWeight: 600 }}>
              🌐 sanpedromotocare.com
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
