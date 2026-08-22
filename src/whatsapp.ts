import {
  makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason,
  isPnUser, isJidGroup, jidDecode, jidNormalizedUser, jidEncode,
} from '@whiskeysockets/baileys'
// @ts-ignore
import qrcodeTerminal from 'qrcode-terminal'
import pino from 'pino'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateAnswer } from './workflow'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const logger = pino({ level: 'warn' })
const AUTH_DIR = path.join(__dirname, '../auth')

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
}

// --- Sender Identity ---

type IdentityType = 'PN' | 'LID' | 'DEVICE' | 'GROUP' | 'UNKNOWN'

interface SenderIdentity {
  rawJid: string
  identityType: IdentityType
  resolvedPhone: string | undefined
  stableId: string
}

function resolveSenderIdentity(
  remoteJid: string | null | undefined,
  participant: string | null | undefined
): SenderIdentity {
  const jid = remoteJid || participant || ''
  if (!jid) return { rawJid: '', identityType: 'UNKNOWN', resolvedPhone: undefined, stableId: 'unknown' }
  if (isJidGroup(jid)) return { rawJid: jid, identityType: 'GROUP', resolvedPhone: undefined, stableId: jid }
  if (jid.endsWith('@lid')) return { rawJid: jid, identityType: 'LID', resolvedPhone: undefined, stableId: jid }

  const decoded = jidDecode(jid)
  if (decoded && decoded.device !== undefined && decoded.device !== null) {
    const baseJid = jidEncode(decoded.user, decoded.server as any)
    return { rawJid: jid, identityType: 'DEVICE', resolvedPhone: decoded.user, stableId: jidNormalizedUser(baseJid) }
  }
  if (isPnUser(jid)) {
    return { rawJid: jid, identityType: 'PN', resolvedPhone: decoded?.user, stableId: jidNormalizedUser(jid) }
  }
  return { rawJid: jid, identityType: 'UNKNOWN', resolvedPhone: undefined, stableId: jid }
}

// --- LID to PN Resolution ---

const lidToPnCache = new Map<string, string>()

function normalizeSenderPn(senderPn: string): string | undefined {
  if (!senderPn) return undefined
  if (senderPn.includes('@s.whatsapp.net')) return senderPn
  if (senderPn.includes(':')) {
    const phone = senderPn.split(':')[0]
    return jidEncode(phone, 's.whatsapp.net')
  }
  return jidEncode(senderPn, 's.whatsapp.net')
}

async function resolveLidViaUsync(lidJid: string): Promise<string | undefined> {
  const decoded = jidDecode(lidJid)
  if (!decoded || !lidJid.endsWith('@lid')) return undefined

  const cached = lidToPnCache.get(decoded.user)
  if (cached) return cached

  try {
    const waSync = await import('@whiskeysockets/baileys/lib/WAUSync/index.js') as any
    const query = new waSync.USyncQuery()
      .withContext('message')
      .withLIDProtocol()
      .withUser(new waSync.USyncUser().withId(lidJid))

    const result = await (sock as any).executeUSyncQuery(query)

    if (result?.list?.length) {
      for (const item of result.list) {
        const pnCandidate = item.lid || item.pn
        if (pnCandidate) {
          const pnJid = pnCandidate.includes('@') ? pnCandidate : jidEncode(pnCandidate, 's.whatsapp.net')
          lidToPnCache.set(decoded.user, pnJid)
          console.log(`[WhatsApp] USync LID resolved: ${lidJid} -> ${pnJid}`)
          return pnJid
        }
      }
    }
  } catch (err) {
    console.warn(`[WhatsApp] USync LID resolution failed: ${(err as Error).message}`)
  }
  return undefined
}

async function resolveSendJid(
  rawJid: string,
  identityType: IdentityType,
  senderPn?: string | null,
): Promise<string> {
  if (identityType !== 'LID') return rawJid

  if (senderPn) {
    const pnJid = normalizeSenderPn(senderPn)
    if (pnJid) {
      console.log(`[WhatsApp] Resolved via senderPn: ${rawJid} -> ${pnJid}`)
      return pnJid
    }
  }

  const decoded = jidDecode(rawJid)
  if (decoded) {
    const cached = lidToPnCache.get(decoded.user)
    if (cached) {
      console.log(`[WhatsApp] Resolved via cache: ${rawJid} -> ${cached}`)
      return cached
    }
  }

  const pnJid = await resolveLidViaUsync(rawJid)
  if (pnJid) {
    console.log(`[WhatsApp] Resolved via USync: ${rawJid} -> ${pnJid}`)
    return pnJid
  }

  console.warn(`[WhatsApp] Could not resolve LID ${rawJid} to PN - sending to LID directly`)
  return rawJid
}

// --- Connection State ---

let sock: ReturnType<typeof makeWASocket> | null = null
let socketId = 0
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectAttempts = 0
let isReconnecting = false

const MAX_RECONNECT = 10
const BASE_DELAY = 2000
const MAX_DELAY = 30000

const processedMessages = new Set<string>()
const MAX_IDS = 5000

function markProcessed(msgId: string): boolean {
  if (processedMessages.has(msgId)) return false
  processedMessages.add(msgId)
  if (processedMessages.size > MAX_IDS) {
    const first = processedMessages.values().next().value
    if (first) processedMessages.delete(first)
  }
  return true
}

function clearTimer() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
}

function delay(): number {
  return Math.min(BASE_DELAY * Math.pow(1.5, reconnectAttempts), MAX_DELAY)
}

// --- Socket Lifecycle ---

function closeSocket() {
  if (!sock) return
  try { sock.end(undefined) } catch (_) {}
  sock = null
}

// --- Main Connection ---

export async function startWhatsAppClient() {
  if (isReconnecting) {
    console.log('[WhatsApp] Reconnect in progress, skipping')
    return { sock }
  }

  ensureDir(AUTH_DIR)
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)

  closeSocket()
  clearTimer()

  const id = ++socketId
  console.log('[WhatsApp] Connecting...')

  sock = makeWASocket({
    auth: state,
    browser: Browsers.baileys('Chrome'),
    logger: logger as any,
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    if (id !== socketId) return
    const { connection, qr, lastDisconnect } = update

    if (qr) {
      isReconnecting = false
      console.log('[WhatsApp] QR code generated')
      // @ts-ignore
      qrcodeTerminal.generate(qr, { small: true })
    }

    if (connection === 'open') {
      isReconnecting = false
      reconnectAttempts = 0
      clearTimer()
      console.log('[WhatsApp] Connected')

      const me = sock?.user
      console.log(`[WhatsApp] Bot identity: ${me?.id}`)
      console.log(`[WhatsApp] Bot LID: ${(me as any)?.lid || 'unknown'}`)
      console.log(`[WhatsApp] Bot name: ${me?.name || 'unknown'}`)

      try {
        await sock!.uploadPreKeysToServerIfRequired()
        console.log('[WhatsApp] Pre-keys synced')
      } catch (e) {
        console.warn('[WhatsApp] Pre-key sync failed:', (e as Error).message)
      }
      return
    }

    if (connection === 'connecting') return

    if (connection === 'close') {
      const error = lastDisconnect?.error as any
      const code: number | undefined = error?.output?.statusCode ?? error?.code
      const conflictType: string | undefined = error?.output?.payload?.type ?? error?.data?.type

      console.log(`[WhatsApp] Connection closed - code: ${code}, type: ${conflictType || 'none'}`)

      if (code === DisconnectReason.loggedOut || conflictType === 'device_removed') {
        console.log('[WhatsApp] Device removed or logged out - clearing auth')
        closeSocket(); clearTimer(); reconnectAttempts = 0; isReconnecting = false
        try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }) } catch (_) {}
        return
      }
      if (code === DisconnectReason.connectionReplaced) {
        console.log('[WhatsApp] Session replaced - clearing auth')
        closeSocket(); clearTimer(); reconnectAttempts = 0; isReconnecting = false
        try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }) } catch (_) {}
        return
      }
      if (code === DisconnectReason.badSession) {
        console.log('[WhatsApp] Bad session - clearing auth')
        closeSocket(); clearTimer(); reconnectAttempts = 0; isReconnecting = false
        try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }) } catch (_) {}
        return
      }
      if (code === DisconnectReason.restartRequired) {
        const d = delay()
        console.log(`[WhatsApp] Restart (515) - reconnecting in ${d}ms`)
        closeSocket(); reconnectAttempts++; isReconnecting = true
        reconnectTimer = setTimeout(() => { reconnectTimer = null; isReconnecting = false; startWhatsAppClient() }, d)
        return
      }
      if (code === 408) {
        const d = delay()
        console.log(`[WhatsApp] Timeout (408) - reconnecting in ${d}ms`)
        closeSocket(); reconnectAttempts++; isReconnecting = true
        reconnectTimer = setTimeout(() => { reconnectTimer = null; isReconnecting = false; startWhatsAppClient() }, d)
        return
      }
      if (reconnectAttempts >= MAX_RECONNECT) {
        console.log('[WhatsApp] Max reconnects reached - stopping')
        closeSocket(); clearTimer(); isReconnecting = false
        return
      }
      const d = delay()
      console.log(`[WhatsApp] Unexpected close (${code}) - reconnecting in ${d}ms`)
      closeSocket(); reconnectAttempts++; isReconnecting = true
      reconnectTimer = setTimeout(() => { reconnectTimer = null; isReconnecting = false; startWhatsAppClient() }, d)
    }
  })

  // --- messages.upsert ---
  sock.ev.on('messages.upsert', async (msg) => {
    if (id !== socketId) return

    for (const m of msg.messages) {
      if (m.key.fromMe) continue
      if (msg.type !== 'notify') continue

      const msgId = m.key.id
      if (!msgId) continue
      if (!markProcessed(msgId)) continue

      const msgContent = m.message?.conversation || m.message?.extendedTextMessage?.text
      if (!msgContent) continue

      const identity = resolveSenderIdentity(m.key.remoteJid, m.key.participant)

      console.log('[WhatsApp] Incoming message')
      console.log(`  key.remoteJid: ${m.key.remoteJid}`)
      console.log(`  key.participant: ${m.key.participant || 'none'}`)
      console.log(`  key.fromMe: ${m.key.fromMe}`)
      console.log(`  key.id: ${m.key.id}`)
      console.log(`  key.senderPn: ${(m.key as any).senderPn || 'none'}`)
      console.log(`  key.senderLid: ${(m.key as any).senderLid || 'none'}`)
      console.log(`  identityType: ${identity.identityType}`)
      console.log(`  stableId: ${identity.stableId}`)
      console.log(`  text: "${msgContent}"`)

      try {
        const botResponse = await generateAnswer(msgContent, identity.stableId)

        const senderPn = (m.key as any).senderPn as string | null | undefined
        const sendJid = await resolveSendJid(identity.rawJid, identity.identityType, senderPn)
        console.log(`[WhatsApp] Sending response to ${sendJid} (type: ${identity.identityType})`)

        const result = await sock!.sendMessage(sendJid, { text: botResponse })
        const outId = result?.key?.id
        console.log(`[WhatsApp] Message accepted - outMsgId: ${outId}`)
        console.log(`[WhatsApp] Outgoing key: remoteJid=${result?.key?.remoteJid}, fromMe=${result?.key?.fromMe}`)
      } catch (err: any) {
        const errCode = err?.output?.statusCode || err?.data?.code
        const errMsg = err?.message || String(err)
        console.error(`[WhatsApp] Send error: ${errMsg}`)
        if (errCode) console.error(`  code: ${errCode}`)
      }
    }
  })

  // --- messages.update (ACK/status tracking) ---
  sock.ev.on('messages.update', async (updates) => {
    if (id !== socketId) return
    for (const update of updates) {
      const status = (update as any).update?.status
      const errParams = (update as any).update?.messageStubParameters
      const key = update.key
      if (key?.fromMe && key?.id) {
        const statusName = status === 0 ? 'ERROR' : status === 1 ? 'PENDING' : status === 2 ? 'SERVER_ACK' : status === 3 ? 'DELIVERY_ACK' : status === 4 ? 'READ' : status === 5 ? 'PLAYED' : `status_${status}`
        console.log(`[WhatsApp] Message update: msgId=${key.id} status=${statusName}`)
        if (errParams?.length) {
          console.log(`[WhatsApp] Stub params: ${JSON.stringify(errParams)}`)
        }
      }
    }
  })

  return { sock }
}