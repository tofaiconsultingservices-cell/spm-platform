"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Lang = "es" | "en";

// ============================================================
// TRANSLATIONS
// ============================================================
const translations = {
  es: {
    // Navigation
    nav_home: "Inicio",
    nav_services: "Servicios",
    nav_tracking: "Rastrear",
    nav_quote: "Cotizar",
    nav_contact: "Contacto",
    nav_login: "Iniciar Sesión",
    nav_portal: "Mi Portal",
    nav_crm: "CRM",

    // Hero
    hero_badge: "Servicio a domicilio en San Pedro Garza García",
    hero_title: "Tu moto lista,",
    hero_title_accent: "en tu puerta",
    hero_subtitle:
      "Mecánicos certificados que van hasta donde estás. Diagnóstico, reparación y mantenimiento sin moverte.",
    hero_cta_quote: "Cotizar ahora",
    hero_cta_track: "Rastrear servicio",
    hero_stat_services: "Servicios",
    hero_stat_satisfaction: "Satisfacción",
    hero_stat_response: "Min respuesta",
    hero_stat_zones: "Zonas cubiertas",

    // Services
    services_badge: "Nuestros Servicios",
    services_title: "Todo lo que tu moto necesita,",
    services_title_accent: "donde la necesita",
    services_subtitle:
      "Desde afinaciones hasta reparaciones mayores. Traemos el taller a ti.",
    services_afinacion_menor: "Afinación Menor",
    services_afinacion_menor_desc: "Cambio de aceite, filtros y bujías. Tu moto como nueva.",
    services_afinacion_mayor: "Afinación Mayor",
    services_afinacion_mayor_desc: "Revisión completa de todos los sistemas críticos.",
    services_frenos: "Sistema de Frenos",
    services_frenos_desc: "Pastillas, discos, líquido. Frenado seguro garantizado.",
    services_electrico: "Sistema Eléctrico",
    services_electrico_desc: "Diagnóstico y reparación de fallas eléctricas.",
    services_suspension: "Suspensión",
    services_suspension_desc: "Ajuste y reparación de horquillas y amortiguadores.",
    services_cadena: "Cadena y Sprockets",
    services_cadena_desc: "Tensión, lubricación y cambio de kit completo.",
    services_neumaticos: "Neumáticos",
    services_neumaticos_desc: "Montaje, balanceo y cambio de llanta en sitio.",
    services_bateria: "Batería",
    services_bateria_desc: "Diagnóstico, carga y reemplazo de batería.",
    services_lavado: "Lavado de Moto",
    services_lavado_desc: "Lavado exterior, limpieza de motor y brillado. Tu moto impecable.",

    // Tracking
    tracking_badge: "Tracking en Vivo",
    tracking_title: "Sigue tu servicio",
    tracking_title_accent: "en tiempo real",
    tracking_subtitle:
      "Ingresa tu número de ticket SPM-XXXX y ve exactamente dónde está tu mecánico.",
    tracking_placeholder: "SPM-1234",
    tracking_btn: "Rastrear",
    tracking_not_found: "Ticket no encontrado",
    tracking_step_1: "Solicitud recibida",
    tracking_step_2: "Diagnóstico",
    tracking_step_3: "Mecánico en camino",
    tracking_step_4: "En servicio",
    tracking_step_5: "Completado",

    // Quote
    quote_badge: "Cotización Gratis",
    quote_title: "¿Cuánto cuesta",
    quote_title_accent: "reparar tu moto?",
    quote_subtitle:
      "Describe el problema y te enviamos una cotización gratis en minutos.",
    quote_name: "Nombre completo",
    quote_phone: "Teléfono / WhatsApp",
    quote_email: "Correo electrónico (opcional)",
    quote_address: "¿Dónde está tu moto?",
    quote_moto_brand: "Marca de moto",
    quote_moto_year: "Año",
    quote_service: "Tipo de servicio",
    quote_desc: "Describe el problema",
    quote_submit: "Solicitar cotización gratis",
    quote_success: "¡Cotización enviada! Te contactamos pronto.",
    quote_error: "Error al enviar. Intenta de nuevo.",

    // Contact
    contact_badge: "Contáctanos",
    contact_title: "Estamos para",
    contact_title_accent: "ayudarte",
    contact_whatsapp: "WhatsApp",
    contact_whatsapp_desc: "Respuesta inmediata",
    contact_call: "Llamar ahora",
    contact_call_desc: "Atención 24/7",
    contact_email: "Email",
    contact_email_desc: "Respuesta en 2 hrs",

    // CTA
    cta_title: "¿Listo para el mejor",
    cta_title_accent: "servicio de motos",
    cta_title_end: "en San Pedro?",
    cta_subtitle: "Agenda hoy y obtén 10% de descuento en tu primera visita.",
    cta_btn: "Cotizar ahora →",

    // Auth
    login_title: "Bienvenido de vuelta",
    login_subtitle: "Accede a tu cuenta SPM",
    login_email: "Correo electrónico",
    login_password: "Contraseña",
    login_btn: "Iniciar sesión",
    login_google: "Continuar con Google",
    login_forgot: "¿Olvidaste tu contraseña?",
    login_no_account: "¿No tienes cuenta?",
    login_register: "Registrarse",

    // Portal
    portal_title: "Mi Portal",
    portal_welcome: "Bienvenido",
    portal_services: "Mis Servicios",
    portal_payments: "Pagos",
    portal_moto: "Mis Motos",
    portal_profile: "Perfil",

    // CRM
    crm_dashboard: "Dashboard",
    crm_tickets: "Tickets",
    crm_clients: "Clientes",
    crm_mechanics: "Mecánicos",
    crm_invoices: "Facturas",
    crm_contact_center: "Contact Center",
    crm_reports: "Reportes",
    crm_settings: "Configuración",

    // Chatbot
    chat_placeholder: "Escribe tu pregunta...",
    chat_send: "Enviar",
    chat_greeting:
      "¡Hola! Soy el asistente virtual de SanPedroMotoCare. ¿En qué puedo ayudarte hoy?",
    chat_title: "Asistente SPM",
    chat_online: "En línea",

    // Common
    loading: "Cargando...",
    error: "Error",
    save: "Guardar",
    cancel: "Cancelar",
    delete: "Eliminar",
    edit: "Editar",
    view: "Ver",
    back: "Regresar",
    next: "Siguiente",
    close: "Cerrar",
    search: "Buscar",
    filter: "Filtrar",
    export: "Exportar",
    create: "Crear",
    update: "Actualizar",
    yes: "Sí",
    no: "No",

    // Footer
    footer_tagline: "El taller que va a donde tú estás.",
    footer_services: "Servicios",
    footer_company: "Empresa",
    footer_legal: "Legal",
    footer_privacy: "Privacidad",
    footer_terms: "Términos",
    footer_rights: "Todos los derechos reservados.",
    footer_zones: "Zonas: San Pedro Garza García, Monterrey, Guadalupe, Santa Catarina",
  },

  en: {
    // Navigation
    nav_home: "Home",
    nav_services: "Services",
    nav_tracking: "Track",
    nav_quote: "Get Quote",
    nav_contact: "Contact",
    nav_login: "Sign In",
    nav_portal: "My Portal",
    nav_crm: "CRM",

    // Hero
    hero_badge: "On-site service in San Pedro Garza García",
    hero_title: "Your bike ready,",
    hero_title_accent: "at your door",
    hero_subtitle:
      "Certified mechanics that come to you. Diagnostics, repair, and maintenance without moving your bike.",
    hero_cta_quote: "Get a quote",
    hero_cta_track: "Track service",
    hero_stat_services: "Services",
    hero_stat_satisfaction: "Satisfaction",
    hero_stat_response: "Min response",
    hero_stat_zones: "Zones covered",

    // Services
    services_badge: "Our Services",
    services_title: "Everything your bike needs,",
    services_title_accent: "where it needs it",
    services_subtitle:
      "From tune-ups to major repairs. We bring the shop to you.",
    services_afinacion_menor: "Minor Tune-up",
    services_afinacion_menor_desc: "Oil change, filters, and spark plugs. Your bike as good as new.",
    services_afinacion_mayor: "Major Tune-up",
    services_afinacion_mayor_desc: "Complete inspection of all critical systems.",
    services_frenos: "Brake System",
    services_frenos_desc: "Pads, rotors, fluid. Safe braking guaranteed.",
    services_electrico: "Electrical System",
    services_electrico_desc: "Diagnostics and repair of electrical faults.",
    services_suspension: "Suspension",
    services_suspension_desc: "Adjustment and repair of forks and shock absorbers.",
    services_cadena: "Chain & Sprockets",
    services_cadena_desc: "Tension, lubrication, and complete kit replacement.",
    services_neumaticos: "Tires",
    services_neumaticos_desc: "Mounting, balancing, and on-site tire replacement.",
    services_bateria: "Battery",
    services_bateria_desc: "Diagnostics, charging, and battery replacement.",
    services_lavado: "Bike Wash",
    services_lavado_desc: "Exterior wash, engine cleaning, and polish. Your bike spotless.",

    // Tracking
    tracking_badge: "Live Tracking",
    tracking_title: "Follow your service",
    tracking_title_accent: "in real time",
    tracking_subtitle:
      "Enter your ticket number SPM-XXXX and see exactly where your mechanic is.",
    tracking_placeholder: "SPM-1234",
    tracking_btn: "Track",
    tracking_not_found: "Ticket not found",
    tracking_step_1: "Request received",
    tracking_step_2: "Diagnosis",
    tracking_step_3: "Mechanic on the way",
    tracking_step_4: "In service",
    tracking_step_5: "Completed",

    // Quote
    quote_badge: "Free Quote",
    quote_title: "How much does it cost",
    quote_title_accent: "to fix your bike?",
    quote_subtitle:
      "Describe the problem and we'll send you a free quote in minutes.",
    quote_name: "Full name",
    quote_phone: "Phone / WhatsApp",
    quote_email: "Email (optional)",
    quote_address: "Where is your bike?",
    quote_moto_brand: "Bike brand",
    quote_moto_year: "Year",
    quote_service: "Service type",
    quote_desc: "Describe the problem",
    quote_submit: "Request free quote",
    quote_success: "Quote sent! We'll contact you soon.",
    quote_error: "Error sending. Please try again.",

    // Contact
    contact_badge: "Contact Us",
    contact_title: "We're here",
    contact_title_accent: "to help",
    contact_whatsapp: "WhatsApp",
    contact_whatsapp_desc: "Immediate response",
    contact_call: "Call now",
    contact_call_desc: "24/7 support",
    contact_email: "Email",
    contact_email_desc: "2-hour response",

    // CTA
    cta_title: "Ready for the best",
    cta_title_accent: "motorcycle service",
    cta_title_end: "in San Pedro?",
    cta_subtitle: "Book today and get 10% off your first visit.",
    cta_btn: "Get a quote →",

    // Auth
    login_title: "Welcome back",
    login_subtitle: "Sign in to your SPM account",
    login_email: "Email",
    login_password: "Password",
    login_btn: "Sign in",
    login_google: "Continue with Google",
    login_forgot: "Forgot your password?",
    login_no_account: "Don't have an account?",
    login_register: "Sign up",

    // Portal
    portal_title: "My Portal",
    portal_welcome: "Welcome",
    portal_services: "My Services",
    portal_payments: "Payments",
    portal_moto: "My Motorcycles",
    portal_profile: "Profile",

    // CRM
    crm_dashboard: "Dashboard",
    crm_tickets: "Tickets",
    crm_clients: "Clients",
    crm_mechanics: "Mechanics",
    crm_invoices: "Invoices",
    crm_contact_center: "Contact Center",
    crm_reports: "Reports",
    crm_settings: "Settings",

    // Chatbot
    chat_placeholder: "Type your question...",
    chat_send: "Send",
    chat_greeting:
      "Hi! I'm the SanPedroMotoCare virtual assistant. How can I help you today?",
    chat_title: "SPM Assistant",
    chat_online: "Online",

    // Common
    loading: "Loading...",
    error: "Error",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    view: "View",
    back: "Back",
    next: "Next",
    close: "Close",
    search: "Search",
    filter: "Filter",
    export: "Export",
    create: "Create",
    update: "Update",
    yes: "Yes",
    no: "No",

    // Footer
    footer_tagline: "The shop that comes to you.",
    footer_services: "Services",
    footer_company: "Company",
    footer_legal: "Legal",
    footer_privacy: "Privacy",
    footer_terms: "Terms",
    footer_rights: "All rights reserved.",
    footer_zones: "Zones: San Pedro Garza García, Monterrey, Guadalupe, Santa Catarina",
  },
};

type TranslationKey = keyof typeof translations.es;

interface LanguageContextValue {
  lang: Lang;
  t: (key: TranslationKey) => string;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("es");

  useEffect(() => {
    const saved = localStorage.getItem("spm-lang") as Lang | null;
    if (saved) setLang(saved);
  }, []);

  function toggleLang() {
    setLang((prev) => {
      const next = prev === "es" ? "en" : "es";
      localStorage.setItem("spm-lang", next);
      return next;
    });
  }

  function t(key: TranslationKey): string {
    return translations[lang][key] ?? key;
  }

  return (
    <LanguageContext.Provider value={{ lang, t, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be inside LanguageProvider");
  return ctx;
}
