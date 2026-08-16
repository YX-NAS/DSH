#!/usr/bin/env node
import { once } from 'node:events'
import { stdin, stdout } from 'node:process'
import { loadConfig } from './config.ts'
import { hashPassword } from './password.ts'
import { createAuthServer } from './server.ts'

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const value of stdin) {
    const chunk: unknown = value
    if (Buffer.isBuffer(chunk)) chunks.push(Buffer.from(chunk))
    else if (typeof chunk === 'string') chunks.push(Buffer.from(chunk))
    else throw new Error('stdin produced an unsupported chunk')
  }
  return Buffer.concat(chunks).toString('utf8').replace(/[\r\n]+$/, '')
}

async function main(): Promise<void> {
  if (process.argv[2] === 'hash-password') {
    const password = await readStdin()
    stdout.write(`${hashPassword(password)}\n`)
    return
  }
  if (process.argv.length > 2) throw new Error('usage: dsh-auth-gateway [hash-password]')
  const config = loadConfig()
  const server = createAuthServer(config)
  server.listen(config.port, config.host)
  await once(server, 'listening')
  stdout.write(`dsh-auth-gateway: http://${config.host}:${config.port}\n`)
}

await main()
