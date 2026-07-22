import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const parsePublishConfig = (env) => {
  const acrName = env.ACR_NAME?.trim()
  const frontendApiBaseUrl = env.FRONTEND_API_BASE_URL?.trim()
  const imageTag = env.IMAGE_TAG?.trim() || 'latest'

  if (!acrName) {
    throw new Error('Missing required environment variable: ACR_NAME')
  }

  if (!frontendApiBaseUrl) {
    throw new Error('Missing required environment variable: FRONTEND_API_BASE_URL')
  }

  return {
    acrName,
    frontendApiBaseUrl,
    imageTag,
  }
}

export const buildImageTargets = ({ acrLoginServer, imageTag, frontendApiBaseUrl }) => [
  {
    name: 'resources-api',
    image: `${acrLoginServer}/resources-api:${imageTag}`,
    dockerfile: 'src/resources-api/Dockerfile',
    buildArgs: [],
  },
  {
    name: 'resources-app',
    image: `${acrLoginServer}/resources-app:${imageTag}`,
    dockerfile: 'src/resources-app/Dockerfile',
    buildArgs: ['--build-arg', `VITE_API_BASE_URL=${frontendApiBaseUrl}`],
  },
]

const assertCommandExists = async (command, execImpl) => {
  try {
    await execImpl('which', [command])
  } catch {
    throw new Error(`Required command not found: ${command}`)
  }
}

export const runPublish = async ({ env = process.env, execFileImpl = execFileAsync } = {}) => {
  const config = parsePublishConfig(env)

  await assertCommandExists('az', execFileImpl)
  await assertCommandExists('docker', execFileImpl)

  const { stdout } = await execFileImpl('az', [
    'acr',
    'show',
    '--name',
    config.acrName,
    '--query',
    'loginServer',
    '-o',
    'tsv',
  ])

  const acrLoginServer = stdout?.trim()

  if (!acrLoginServer) {
    throw new Error(`Could not resolve login server for ACR: ${config.acrName}`)
  }

  return {
    config,
    acrLoginServer,
    targets: buildImageTargets({
      acrLoginServer,
      imageTag: config.imageTag,
      frontendApiBaseUrl: config.frontendApiBaseUrl,
    }),
  }
}
