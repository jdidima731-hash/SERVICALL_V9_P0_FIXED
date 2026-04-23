
// Types globaux pour résoudre les erreurs TypeScript

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

// Types pour les modules manquants
declare module 'tw-animate-css' {
  const content: unknown;
  export default content;
}
