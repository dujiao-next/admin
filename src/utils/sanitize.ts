import DOMPurify from 'dompurify'

const SAFE_URI_PATTERN = /^(?:https?:|mailto:|tel:|#|\/(?!\/))/i

export function sanitizeRichHtml(raw: string): string {
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre', 'blockquote',
      'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'span', 'div', 'img', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'title', 'colspan', 'rowspan'],
    FORBID_ATTR: ['style', 'class', 'id'],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: SAFE_URI_PATTERN,
  })
}

export function sanitizeTelegramHtml(raw: string): string {
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'code', 'pre', 'a', 'blockquote', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'title'],
    FORBID_ATTR: ['style', 'class', 'id'],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: SAFE_URI_PATTERN,
  })
}
