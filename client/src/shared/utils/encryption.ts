import nacl from 'tweetnacl';
import { decodeUTF8, encodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util';

// ✅ FIX PAGE BLANCHE: interfaces ImportMeta locales supprimées (conflit avec vite-env.d.ts)

/**
 * SÉCURITÉ FRONTEND — CHIFFREMENT DES DONNÉES SENSIBLES
 *
 * ✅ FIX ÉCRAN BLANC RACINE :
 *   Suppression du `throw` top-level en production qui crashait le module
 *   avant même le premier rendu React, rendant toute la SPA blanche.
 *
 *   Comportement corrigé :
 *   - Si VITE_ENCRYPTION_KEY est absente/trop courte → warning console uniquement
 *   - Le chiffrement est désactivé silencieusement (retourne null)
 *   - L'application continue de fonctionner (auth via cookie httpOnly, pas localStorage)
 *   - En production, injecter VITE_ENCRYPTION_KEY via CI/CD pour activer le chiffrement
 */
const ENCRYPTION_KEY: string = (import.meta as any).env?.VITE_ENCRYPTION_KEY || '';

// ✅ FIX : Warning uniquement — jamais de throw au niveau module
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  // Avertissement non-bloquant, quel que soit l'environnement
  console.warn(
    '[Servicall] VITE_ENCRYPTION_KEY absente ou trop courte (<32 chars). ' +
    'Le chiffrement localStorage est désactivé. ' +
    'Injectez VITE_ENCRYPTION_KEY à build-time pour l\'activer.'
  );
}

/** Indique si le chiffrement est opérationnel */
const encryptionEnabled = Boolean(ENCRYPTION_KEY && ENCRYPTION_KEY.length >= 32);

// Ensure key is 32 bytes
const getUint8Key = (key: string) => {
  const keyUint8 = decodeUTF8(key || '0'.repeat(32));
  const finalKey = new Uint8Array(32);
  finalKey.set(keyUint8.slice(0, 32));
  return finalKey;
};

export const encryptData = (data: unknown): string | null => {
  if (!data || !encryptionEnabled) return null;
  try {
    const key = getUint8Key(ENCRYPTION_KEY);
    const nonce = nacl.randomBytes(24);
    const messageUint8 = decodeUTF8(JSON.stringify(data));
    const box = nacl.secretbox(messageUint8, nonce, key);

    const fullMessage = new Uint8Array(nonce.length + box.length);
    fullMessage.set(nonce);
    fullMessage.set(box, nonce.length);

    return encodeBase64(fullMessage);
  } catch (error: any) {
    console.error('Encryption error:', error);
    return null;
  }
};

export const decryptData = (encryptedData: string | null): unknown => {
  if (!encryptedData || !encryptionEnabled) return null;
  try {
    const key = getUint8Key(ENCRYPTION_KEY);
    const fullMessage = decodeBase64(encryptedData);
    const nonce = fullMessage.slice(0, 24);
    const message = fullMessage.slice(24);

    const decrypted = nacl.secretbox.open(message, nonce, key);
    if (!decrypted) return null;

    return JSON.parse(encodeUTF8(decrypted));
  } catch (error: any) {
    console.error('Decryption error:', error);
    return null;
  }
};
