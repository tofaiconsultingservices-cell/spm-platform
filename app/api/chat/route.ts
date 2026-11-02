import { NextRequest, NextResponse } from "next/server";
import { Mistral } from "@mistralai/mistralai";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

// 20 requests per minute per IP
const rateLimiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

const SYSTEM_PROMPT = `Eres el asistente virtual de SanPedroMotoCare, un servicio de mecánicos a domicilio en San Pedro Garza García, Monterrey, México.

Tu rol es:
1. Ayudar a los clientes a identificar qué servicio necesitan para su motocicleta
2. Dar cotizaciones aproximadas (sin comprometerte a precios exactos)
3. Explicar los servicios disponibles
4. Agendar o dirigir al cliente al formulario de cotización
5. Responder preguntas sobre el área de cobertura, horarios y procesos

Información clave:
- Servicios: Afinación menor/mayor, frenos, sistema eléctrico, suspensión, cadena y sprockets, neumáticos, batería, carburador/inyección, motor, diagnóstico, lavado de moto (lavado exterior + limpieza de motor + brillado)
- Área de cobertura: San Pedro Garza García, Monterrey, Guadalupe, Apodaca, Santa Catarina, San Nicolás
- Horario: Lunes a Domingo 7am–9pm, urgencias 24/7
- Tiempo de respuesta: 45 minutos promedio
- Pago: Efectivo, tarjeta, transferencia
- Contacto WhatsApp: +52 81 3388-0010

Responde siempre en el mismo idioma que el usuario (español o inglés).
Sé amable, profesional y conciso (máximo 3 párrafos por respuesta).
Si no sabes algo específico, invita al cliente a contactar vía WhatsApp o llenar el formulario de cotización.`;

export async function POST(req: NextRequest) {
  // ── Rate limiting ──────────────────────────────────────────────────────────
  const ip = getClientIp(req);
  const rl = rateLimiter(ip);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rl.retryAfter),
          "X-RateLimit-Limit": "20",
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  try {
    const { message, history } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Invalid message" }, { status: 400 });
    }

    // MISTRAL_API_KEY is server-only (no NEXT_PUBLIC_ prefix) to prevent exposure to the browser
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Mistral API not configured" },
        { status: 500 }
      );
    }

    const client = new Mistral({ apiKey });

    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      ...(history ?? [])
        .slice(-10)
        .map((msg: { role: string; content: string }) => ({
          role: (msg.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
          content: msg.content,
        })),
      { role: "user" as const, content: message },
    ];

    const result = await client.chat.complete({
      model: "mistral-small-latest",
      messages,
    });

    const reply = result.choices?.[0]?.message?.content ?? "";

    if (!reply) {
      console.error("[chat] Empty reply from Mistral");
    }

    return NextResponse.json({ reply });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[chat] Unhandled error:", msg);
    return NextResponse.json(
      { error: "Error procesando tu mensaje. Intenta de nuevo.", detail: msg },
      { status: 500 }
    );
  }
}
