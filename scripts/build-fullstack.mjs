import { spawnSync } from 'node:child_process'

const env = {
  ...process.env,
  VITE_FULLSTACK: '1',
}

const result = spawnSync('vite', ['build'], {
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

process.exit(result.status ?? 1)
