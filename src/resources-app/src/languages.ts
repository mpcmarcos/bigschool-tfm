export const SUPPORTED_LANGUAGES = [
  { code: 'pt-br', label: 'Português (Brasil)', flagSrc: '/flags/pt-br.svg' },
  { code: 'es-es', label: 'Español', flagSrc: '/flags/es-es.svg' },
  { code: 'en-uk', label: 'English (United Kingdom)', flagSrc: '/flags/en-uk.svg' },
] as const

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code']