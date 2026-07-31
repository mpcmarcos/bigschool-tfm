import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const assetsDir = path.join(repoRoot, 'docs', 'presentation', 'assets')

const appOrigin = process.env.PRESENTATION_APP_URL ?? 'http://127.0.0.1:5173'
const apiOrigin = 'http://localhost:5174'
const viewport = { width: 1440, height: 900 }
const themeStorageKey = 'resources-app-theme'
const sessionStorageKey = 'resources-auth-session'

const authSession = {
  accessToken: 'presentation-access-token',
  refreshToken: 'presentation-refresh-token',
  tokenType: 'Bearer',
  expiresIn: 3600,
  user: {
    id: 'user-demo',
    email: 'marcos@example.com',
    lastLoginAt: '2026-07-31T10:00:00Z',
  },
}

const demoProject = {
  id: 'project-commerce',
  name: 'App móvil Commerce',
  description: 'Gestión del checkout para storefront multi-idioma.',
  ownerUserId: 'user-demo',
  ownerEmail: 'marcos@example.com',
  createdAt: '2026-07-28T09:15:00Z',
  updatedAt: '2026-07-31T08:45:00Z',
  isDeleted: false,
}

const demoMembers = [
  {
    id: 'member-marcos',
    projectId: demoProject.id,
    userId: 'user-demo',
    email: 'marcos@example.com',
    role: 'admin',
    createdAt: '2026-07-28T09:15:00Z',
    updatedAt: '2026-07-31T08:45:00Z',
    isDeleted: false,
  },
  {
    id: 'member-ana',
    projectId: demoProject.id,
    userId: 'user-ana',
    email: 'ana@example.com',
    role: 'editor',
    createdAt: '2026-07-29T11:00:00Z',
    updatedAt: '2026-07-31T08:45:00Z',
    isDeleted: false,
  },
]

const demoPage = {
  id: 'page-checkout',
  projectId: demoProject.id,
  name: 'Checkout',
  description: 'Pantalla de pago y confirmación del pedido.',
  createdAt: '2026-07-28T10:00:00Z',
  updatedAt: '2026-07-31T08:45:00Z',
  isDeleted: false,
}

const demoPageVersions = [
  {
    id: 'page-version-v1',
    pageId: demoPage.id,
    name: 'v1.0',
    isDefault: true,
    createdAt: '2026-07-28T12:00:00Z',
    updatedAt: '2026-07-31T08:45:00Z',
    isDeleted: false,
  },
  {
    id: 'page-version-v2',
    pageId: demoPage.id,
    name: 'v2.0',
    isDefault: false,
    createdAt: '2026-07-30T15:20:00Z',
    updatedAt: '2026-07-31T08:45:00Z',
    isDeleted: false,
  },
]

const demoResource = {
  id: 'resource-checkout-pay-button',
  pageVersionId: 'page-version-v1',
  key: 'checkout.pay_button',
  description: 'Texto del botón principal de pago',
  createdAt: '2026-07-28T12:30:00Z',
  updatedAt: '2026-07-31T08:45:00Z',
  isDeleted: false,
}

const demoTranslations = {
  'es-es': {
    id: 'resource-version-es',
    resourceId: demoResource.id,
    languageCode: 'es-es',
    value: 'Pagar ahora',
    createdAt: '2026-07-28T12:35:00Z',
    updatedAt: '2026-07-31T08:45:00Z',
    isDeleted: false,
  },
  'en-uk': {
    id: 'resource-version-en',
    resourceId: demoResource.id,
    languageCode: 'en-uk',
    value: 'Pay now',
    createdAt: '2026-07-28T12:36:00Z',
    updatedAt: '2026-07-31T08:45:00Z',
    isDeleted: false,
  },
  'pt-br': {
    id: 'resource-version-pt',
    resourceId: demoResource.id,
    languageCode: 'pt-br',
    value: 'Pagar agora',
    createdAt: '2026-07-28T12:37:00Z',
    updatedAt: '2026-07-31T08:45:00Z',
    isDeleted: false,
  },
}

const captureOrder = [
  '01-home.png',
  '02-login.png',
  '03-projects.png',
  '04-project-members.png',
  '05-pages.png',
  '06-page-versions.png',
  '07-resources.png',
  '08-translations.png',
  '09-automatic-translations.png',
]

const chromeCandidates = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].filter(Boolean)

const translationsScenario = {
  full: [demoTranslations['es-es'], demoTranslations['en-uk'], demoTranslations['pt-br']],
  modal: [demoTranslations['es-es']],
}

const resourceVersionsPath =
  `/api/v1/projects/${demoProject.id}/pages/${demoPage.id}/versions/${demoPageVersions[0].id}/resources/${demoResource.id}/versions`

const fixedMockResponses = new Map([
  ['GET /health', { status: 'ok' }],
  ['GET /api/v1/projects', [demoProject]],
  [`GET /api/v1/projects/${demoProject.id}/members`, demoMembers],
  [`GET /api/v1/projects/${demoProject.id}/pages`, [demoPage]],
  [`GET /api/v1/projects/${demoProject.id}/pages/${demoPage.id}/versions`, demoPageVersions],
  [`GET /api/v1/projects/${demoProject.id}/pages/${demoPage.id}/versions/${demoPageVersions[0].id}/resources`, [demoResource]],
  [
    `POST /api/v1/projects/${demoProject.id}/pages/${demoPage.id}/versions/${demoPageVersions[0].id}/resources/${demoResource.id}/automatic-translations`,
    { translations: [demoTranslations['en-uk'], demoTranslations['pt-br']] },
  ],
])

const jsonHeaders = {
  'access-control-allow-origin': '*',
  'content-type': 'application/json',
}

const ensureFrontendIsReachable = async () => {
  let response

  try {
    response = await fetch(appOrigin)
  } catch (error) {
    throw new Error(
      `Frontend not reachable at ${appOrigin}. Start it with: npm --prefix src/resources-app run dev -- --host 127.0.0.1`,
      { cause: error },
    )
  }

  if (!response.ok) {
    throw new Error(`Frontend responded with ${response.status} at ${appOrigin}`)
  }
}

const assertFileDimensions = async (filePath) => {
  const buffer = await fs.readFile(filePath)
  if (buffer.length < 24) {
    throw new Error(`PNG is truncated: ${filePath}`)
  }

  const signature = buffer.subarray(0, 8).toString('hex')
  if (signature !== '89504e470d0a1a0a') {
    throw new Error(`Not a PNG file: ${filePath}`)
  }

  const width = buffer.readUInt32BE(16)
  const height = buffer.readUInt32BE(20)

  if (width !== viewport.width || height !== viewport.height) {
    throw new Error(`Unexpected dimensions for ${path.basename(filePath)}: ${width}x${height}`)
  }
}

const launchBrowser = async () => {
  const attempts = [
    ...chromeCandidates.map((executablePath) => ({ executablePath })),
    {},
  ]

  let lastError = null

  for (const attempt of attempts) {
    try {
      return await chromium.launch({
        headless: true,
        ...attempt,
      })
    } catch (error) {
      lastError = error
    }
  }

  throw new Error(
    'Unable to launch Chromium. Install the Playwright browser with "npx playwright install chromium" or set PLAYWRIGHT_CHROMIUM_EXECUTABLE.',
    { cause: lastError },
  )
}

const fulfillJson = async (route, status, body) => {
  await route.fulfill({
    status,
    headers: jsonHeaders,
    body: JSON.stringify(body),
  })
}

const installApiMocks = async (context) => {
  const state = {
    resourceVersionsMode: 'full',
    hits: [],
  }

  await context.route(`${apiOrigin}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const pathname = url.pathname
    const method = request.method()
    const requestKey = `${method} ${pathname}`

    state.hits.push(requestKey)

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: jsonHeaders })
      return
    }

    if (requestKey === `GET ${resourceVersionsPath}`) {
      const body = state.resourceVersionsMode === 'modal' ? translationsScenario.modal : translationsScenario.full
      await fulfillJson(route, 200, body)
      return
    }

    const responseBody = fixedMockResponses.get(requestKey)
    if (responseBody) {
      await fulfillJson(route, 200, responseBody)
      return
    }

    await fulfillJson(route, 404, {
      title: 'Mock not implemented',
      detail: `Unhandled request: ${method} ${pathname}`,
    })
  })

  return state
}

const installLocalStorageState = async (page, { session }) => {
  await page.addInitScript(
    ({ storedTheme, storedSession, themeKey, sessionKey }) => {
      window.localStorage.setItem(themeKey, storedTheme)
      if (storedSession) {
        window.localStorage.setItem(sessionKey, JSON.stringify(storedSession))
      } else {
        window.localStorage.removeItem(sessionKey)
      }
    },
    {
      storedTheme: 'dark',
      storedSession: session,
      themeKey: themeStorageKey,
      sessionKey: sessionStorageKey,
    },
  )
}

const waitForAppToSettle = async (page, expectedText) => {
  if (expectedText) {
    await page.getByRole('heading', { name: expectedText, exact: true }).waitFor({ state: 'visible' })
  }

  await page.waitForFunction(() => !document.body.innerText.includes('Cargando'))
}

const capture = async (page, fileName) => {
  const target = path.join(assetsDir, fileName)
  await page.screenshot({ path: target })
  await assertFileDimensions(target)
}

const createPage = async (context, session) => {
  const page = await context.newPage()

  await page.route(
    `${apiOrigin}/api/v1/projects/project-commerce/pages/page-checkout/versions/page-version-v1/resources/resource-checkout-pay-button/automatic-translations`,
    async (route) => {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ translations: [demoTranslations['en-uk'], demoTranslations['pt-br']] }),
      })
    },
  )

  await installLocalStorageState(page, { session })
  return page
}

const main = async () => {
  await ensureFrontendIsReachable()
  await fs.mkdir(assetsDir, { recursive: true })

  const browser = await launchBrowser()
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    locale: 'es-ES',
  })
  const apiState = await installApiMocks(context)

  try {
    const publicPage = await createPage(context, null)

    await publicPage.goto(`${appOrigin}/`, { waitUntil: 'networkidle' })
    await waitForAppToSettle(publicPage, 'Diseño y copy siempre sincronizados con producto.')
    await capture(publicPage, '01-home.png')

    await publicPage.goto(`${appOrigin}/login`, { waitUntil: 'networkidle' })
    await waitForAppToSettle(publicPage, 'Iniciar sesión')
    await capture(publicPage, '02-login.png')
    await publicPage.close()

    const appPage = await createPage(context, authSession)
    await appPage.goto(`${appOrigin}/projects`, { waitUntil: 'networkidle' })
    await waitForAppToSettle(appPage, 'Proyectos')
    await appPage.getByText('App móvil Commerce', { exact: true }).waitFor({ state: 'visible' })
    await capture(appPage, '03-projects.png')

    await appPage.getByRole('button', { name: 'Compartir' }).click()
    await appPage.getByRole('dialog', { name: 'Compartir proyecto' }).waitFor({ state: 'visible' })
    await appPage.getByText('marcos@example.com · admin', { exact: true }).waitFor({ state: 'visible' })
    await appPage.getByText('ana@example.com · editor', { exact: true }).waitFor({ state: 'visible' })
    await capture(appPage, '04-project-members.png')

    await appPage.getByRole('button', { name: 'Cerrar' }).click()
    await appPage.getByRole('button', { name: 'Ver páginas' }).click()
    await waitForAppToSettle(appPage, 'Páginas del proyecto')
    await appPage.getByText('Checkout', { exact: true }).waitFor({ state: 'visible' })
    await capture(appPage, '05-pages.png')

    await appPage.getByRole('button', { name: 'Ver versiones' }).click()
    await waitForAppToSettle(appPage, 'Versiones de página')
    await appPage.getByText('v1.0 · default', { exact: true }).waitFor({ state: 'visible' })
    await capture(appPage, '06-page-versions.png')

    await appPage.locator('li.project-card').filter({ hasText: 'v1.0 · default' }).getByRole('button', { name: 'Ver recursos' }).click()
    await waitForAppToSettle(appPage, 'Recursos en versión de página')
    await appPage.getByText('checkout.pay_button', { exact: true }).waitFor({ state: 'visible' })
    await capture(appPage, '07-resources.png')

    await appPage.getByRole('button', { name: 'Ver traducciones' }).click()
    await waitForAppToSettle(appPage, 'Traducciones del recurso')
    await appPage.getByText('Pagar agora', { exact: true }).waitFor({ state: 'visible' })
    await capture(appPage, '08-translations.png')

    apiState.resourceVersionsMode = 'modal'
    await appPage.reload({ waitUntil: 'networkidle' })
    await waitForAppToSettle(appPage, 'Traducciones del recurso')
    await appPage.getByRole('button', { name: 'Añadir traducciones automáticas' }).click()
    await appPage.getByRole('dialog', { name: 'Añadir traducciones automáticas' }).waitFor({ state: 'visible' })
    await appPage.getByText('English (United Kingdom)', { exact: true }).waitFor({ state: 'visible' })
    await appPage.getByText('Português (Brasil)', { exact: true }).waitFor({ state: 'visible' })
    await capture(appPage, '09-automatic-translations.png')
    await appPage.close()

    for (const fileName of captureOrder) {
      await assertFileDimensions(path.join(assetsDir, fileName))
    }

    const uniqueHits = [...new Set(apiState.hits)]
    const summary = {
      appOrigin,
      viewport,
      files: captureOrder,
      mockedRoutes: uniqueHits,
    }

    console.log(JSON.stringify(summary, null, 2))
  } finally {
    await context.close()
    await browser.close()
  }
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : error)
  process.exitCode = 1
}