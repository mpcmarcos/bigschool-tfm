import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildImageTargets,
  parsePublishConfig,
} from './publish-azure-images.mjs'

test('parsePublishConfig defaults IMAGE_TAG to latest', () => {
  const config = parsePublishConfig({
    ACR_NAME: 'acrschooldev',
    FRONTEND_API_BASE_URL: 'https://api.example.com',
  })

  assert.deepEqual(config, {
    acrName: 'acrschooldev',
    frontendApiBaseUrl: 'https://api.example.com',
    imageTag: 'latest',
  })
})

test('parsePublishConfig throws when ACR_NAME is missing', () => {
  assert.throws(
    () =>
      parsePublishConfig({
        FRONTEND_API_BASE_URL: 'https://api.example.com',
      }),
    /ACR_NAME/,
  )
})

test('buildImageTargets returns API and frontend image definitions', () => {
  const targets = buildImageTargets({
    acrLoginServer: 'acrschooldev.azurecr.io',
    imageTag: 'sha123',
    frontendApiBaseUrl: 'https://api.example.com',
  })

  assert.deepEqual(targets, [
    {
      name: 'resources-api',
      image: 'acrschooldev.azurecr.io/resources-api:sha123',
      dockerfile: 'src/resources-api/Dockerfile',
      buildArgs: [],
    },
    {
      name: 'resources-app',
      image: 'acrschooldev.azurecr.io/resources-app:sha123',
      dockerfile: 'src/resources-app/Dockerfile',
      buildArgs: ['--build-arg', 'VITE_API_BASE_URL=https://api.example.com'],
    },
  ])
})
