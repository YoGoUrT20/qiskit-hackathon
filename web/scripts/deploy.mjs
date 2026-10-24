import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'

const env = Object.fromEntries(
  (existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '')
    .split(/\r?\n/)
    .flatMap((line) => (/^\w+=/.test(line) ? [line.split(/=(.*)/s).slice(0, 2)] : [])),
)
const conf = (k) => process.env[k] ?? env[k]

const args = process.argv.slice(2)
const only = args.find((a) => a === '--site' || a === '--convex')
const host = conf('DEPLOY_HOST')
const putty = conf('DEPLOY_PUTTY_SESSION')

function run(cmd, cmdArgs, opts = {}) {
  console.log(`> ${cmd} ${cmdArgs.join(' ')}`)
  const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit', shell: process.platform === 'win32' && opts.shell, ...opts })
  if (r.status !== 0) {
    console.error(`failed: ${cmd} (${r.error?.message ?? `exit ${r.status}`})`)
    process.exit(1)
  }
}

const remote = (script) =>
  putty ? run('plink', ['-batch', '-load', putty, '-l', host.split('@')[0], script]) : run('ssh', [host, script])
const upload = (file, dest) =>
  putty ? run('pscp', ['-batch', '-q', '-load', putty, file, `${host}:${dest}`]) : run('scp', [file, `${host}:${dest}`])

if (only !== '--site') {
  if (!conf('CONVEX_SELF_HOSTED_URL') || !conf('CONVEX_SELF_HOSTED_ADMIN_KEY')) {
    console.error('Set CONVEX_SELF_HOSTED_URL and CONVEX_SELF_HOSTED_ADMIN_KEY in web/.env.local')
    process.exit(1)
  }
  run('npx', ['convex', 'deploy', '-y'], { shell: true })
}

if (only !== '--convex') {
  if (!host) {
    console.error('Set DEPLOY_HOST in web/.env.local')
    process.exit(1)
  }
  run('npm', ['run', 'build'], { shell: true })
  rmSync('site.tgz', { force: true })
  run('tar', ['-czf', 'site.tgz', '-C', 'dist', '.'])
  remote('mkdir -p ~/ghost-walk/upload')
  upload('site.tgz', 'ghost-walk/upload/site.tgz')
  rmSync('site.tgz', { force: true })
  remote(
    [
      'set -e',
      'rel=/var/www/ghost/releases/$(date -u +%Y%m%d-%H%M%S)',
      'mkdir -p "$rel"',
      'tar -xzf ~/ghost-walk/upload/site.tgz -C "$rel"',
      'ln -sfn "$rel" /var/www/ghost/current.tmp',
      'mv -T /var/www/ghost/current.tmp /var/www/ghost/current',
      'cd /var/www/ghost/releases && ls -1 | head -n -5 | xargs -r rm -rf',
      'echo "live: $rel"',
    ].join(' && '),
  )
}
