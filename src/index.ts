import { startWhatsAppClient } from './whatsapp'

async function main() {
  console.log('Starting WhatsApp bot...')
  const { sock } = await startWhatsAppClient()

  if (!sock?.user) {
    console.info('Waiting for QR code scan...')
  }
}

main().catch(console.error)