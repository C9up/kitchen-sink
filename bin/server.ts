/**
 * Kitchen-sink entrypoint. The framework's `createHyperServerFactory()`
 * handles platform detection + napi loading — no per-app duplication.
 */
import 'reflect-metadata'
import { Ignitor, prettyPrintError } from '@c9up/ream'
import { createHyperServerFactory } from '@c9up/ream/bootstrap'

const APP_ROOT = new URL('../', import.meta.url)

const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, APP_ROOT).href)
  }
  return import(filePath)
}

new Ignitor(APP_ROOT, {
  importer: IMPORTER,
  port: Number(process.env.PORT ?? 3100),
  serverFactory: createHyperServerFactory(),
})
  .tap((app) => {
    app.listen('SIGTERM', () => app.terminate())
    app.listenIf(app.managedByPm2, 'SIGINT', () => app.terminate())
  })
  .useRcFile((await import('../reamrc.js')).default)
  .httpServer()
  .start()
  .then(async (ignitor) => {
    const port = await ignitor.port()
    const { Logger } = await import('@c9up/spectrum')
    const logger = ignitor
      .getApp()
      .container.resolve<InstanceType<typeof Logger>>('logger')
    logger.info(`kitchen-sink running on http://localhost:${port}`)
  })
  .catch((err) => {
    prettyPrintError(err)
    process.exit(1)
  })
