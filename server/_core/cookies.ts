import type { CookieOptions, Request } from "express";

function isSecureRequest(req: Request) {
  // ✅ FIX: En production, toujours considérer la connexion comme sécurisée
  // même si le header x-forwarded-proto est absent (ex: proxy Nginx mal configuré)
  if (process.env["NODE_ENV"] === "production") return true;

  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const isSecure = isSecureRequest(req);

  // SameSite strategy:
  // - HTTPS (direct ou via proxy) → SameSite=none + Secure=true
  //   Requis quand le front et l'API sont sur des domaines différents (proxy ngrok/Manus)
  //   Sans ça, le cookie session n'est pas envoyé sur les requêtes cross-site → "session vide"
  // - HTTP local (dev sans proxy) → SameSite=lax + Secure=false
  //   SameSite=none requiert Secure=true — impossible en HTTP pur
  const sameSite: "none" | "lax" = isSecure ? "none" : "lax";

  return {
    domain: undefined,
    httpOnly: true,
    path: "/",
    sameSite,
    secure: isSecure,
  };
}
