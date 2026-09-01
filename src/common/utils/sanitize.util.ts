/**
 * Utilitário de sanitização contra XSS
 *
 * Remove tags HTML/JavaScript perigosas de textos de utilizador
 * antes de guardar na base de dados ou exibir.
 *
 * NOTA: Este é um sanitizador leve. Para aplicações que precisam
 * de HTML rico, considere usar DOMPurify no frontend.
 */

// Padrões de scripts e eventos perigosos
const DANGEROUS_PATTERNS = [
  // Script tags
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  // Event handlers inline
  /\son\w+\s*=\s*["'][^"']*["']/gi,
  //javascript: protocol
  /javascript\s*:/gi,
  // data: protocol (pode ser usado para XSS)
  /data\s*:\s*text\/html/gi,
  // vbscript: (IE)
  /vbscript\s*:/gi,
  // <iframe> tags
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  // <object> tags
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  // <embed> tags
  /<embed\b[^>]*>/gi,
  // <base> tag
  /<base\b[^>]*>/gi,
  // <meta> refresh
  /<meta\b[^>]*http-equiv\s*=\s*["']refresh["'][^>]*>/gi,
  // <link> with javascript
  /<link\b[^>]*href\s*=\s*["']javascript:[^"']*["'][^>]*>/gi,
];

// Tags HTML permitidas (para formatação básica)
const ALLOWED_TAGS = [
  'b',
  'i',
  'u',
  'em',
  'strong',
  'p',
  'br',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'code',
];

/**
 * Remove scripts e eventos perigosos de um texto
 */
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') {
    return input;
  }

  let sanitized = input;

  // Remover padrões perigosos
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Decodificar entidades HTML comuns usadas em XSS
  sanitized = sanitized
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');

  return sanitized.trim();
}

/**
 * Remove TODAS as tags HTML (para campos que devem ser texto puro)
 */
export function stripAllHtml(input: string): string {
  if (!input || typeof input !== 'string') {
    return input;
  }

  return input
    .replace(/<[^>]*>/g, '') // Remove todas as tags HTML
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Valida se uma URL é segura (previne XSS via href/src)
 */
export function isValidSecureUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  const normalizedUrl = url.trim().toLowerCase();

  // Bloquear protocolos perigosos
  const dangerousProtocols = [
    'javascript:',
    'vbscript:',
    'data:',
    'file:',
  ];

  for (const protocol of dangerousProtocols) {
    if (normalizedUrl.startsWith(protocol)) {
      return false;
    }
  }

  // Permitir apenas http, https e相对路径
  if (
    normalizedUrl.startsWith('http://') ||
    normalizedUrl.startsWith('https://') ||
    normalizedUrl.startsWith('/')
  ) {
    return true;
  }

  // URLs relativos (sem protocolo)
  if (!normalizedUrl.includes('://')) {
    return true;
  }

  return false;
}
