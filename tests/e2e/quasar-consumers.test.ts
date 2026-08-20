/**
 * The three packages that store in Redis, all on ONE quasar connection.
 *
 * This lives here rather than in echo, bay or warden: a test that crosses two
 * packages belongs to neither, and warden's CI asserts it has zero @c9up
 * dependencies. kitchen-sink is where the wiring is allowed to be real.
 *
 * What it proves — and a fake could not — is that a QuasarConnection actually
 * carries the commands each driver issues, and that the three share the socket
 * instead of opening one apiece.
 *
 * Skipped, not failed, when no server answers on REDIS_TEST_URL.
 */

import { drivers } from '@c9up/echo'
import { RedisDriver as QueueDriver, quasarConnection as bayConnection } from '@c9up/bay'
import { QuasarManager } from '@c9up/quasar'
import { setQuasar } from '@c9up/quasar/services/main'
import { RedisBlacklistDriver, quasarConnection as wardenConnection } from '@c9up/warden'
import { test } from '@c9up/helix'

const url = process.env.REDIS_TEST_URL ?? 'redis://127.0.0.1:6379'
const manager = new QuasarManager({
  connection: 'main',
  connections: { main: { url, db: 15 } },
})

const live = await manager
  .connection()
  .ping()
  .then(() => true)
  .catch(() => false)

if (live) setQuasar(manager)

const prefix = `kitchen:${process.pid}:`

test('echo caches through the shared quasar connection', async ({ assert }) => {
  if (!live) return
  const cache = drivers.redis({ connection: 'main', prefix: `${prefix}cache:` })()

  await cache.set('user:42', { name: 'Hugo' }, 30)
  assert.deepEqual(await cache.get('user:42'), { name: 'Hugo' })
  await cache.delete('user:42')
})

test('bay queues through the shared quasar connection', async ({ assert }) => {
  if (!live) return
  const queue = new QueueDriver(bayConnection('main'), { prefix: `${prefix}queue:` })
  const job = {
    id: 'j1',
    name: 'send-mail',
    payload: {},
    attempts: 0,
    maxAttempts: 3,
    status: 'pending' as const,
    createdAt: Date.now(),
  }

  await queue.push(job)
  const popped = await queue.pop()
  assert.equal(popped?.id, 'j1')
  if (popped) await queue.complete(popped)
})

test('warden revokes through the shared quasar connection', async ({ assert }) => {
  if (!live) return
  const blacklist = new RedisBlacklistDriver(wardenConnection('main'), { prefix: `${prefix}jwt:` })

  assert.isFalse(await blacklist.has('token-1'))
  await blacklist.add('token-1', Date.now() + 60_000)
  assert.isTrue(await blacklist.has('token-1'))
})

test('the three share one connection, not three', async ({ assert }) => {
  if (!live) return
  // Each driver above resolved through the same manager, so exactly one
  // connection is open — the point of owning the connection in one place.
  assert.deepEqual(manager.activeConnectionNames, ['main'])
  await manager.quit()
})
