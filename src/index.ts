import { initializeDatabase, seedContactProfiles } from './memory'
import { getConfiguredContactProfiles, toContactProfile } from './contactProfiles'
import { startWhatsAppClient } from './whatsapp'

async function main() {
  console.log('Starting WhatsApp bot...')
  initializeDatabase()

  const configured = getConfiguredContactProfiles()
  if (configured.length > 0) {
    const profiles = configured.map(c => ({ ...toContactProfile(c), stableId: c.stableId }))
    seedContactProfiles(profiles)
  }

  const { sock } = await startWhatsAppClient()

  if (!sock?.user) {
    console.info('Waiting for QR code scan...')
  }
}

main().catch(console.error)
