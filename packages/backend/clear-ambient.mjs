import Twilio from 'twilio';
import fs from 'node:fs';
const env = Object.fromEntries(
  fs.readFileSync('../../.env.horizon','utf8').split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map(l => [l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')])
);
const c = Twilio(env.TWILIO_API_KEY || env.TWILIO_ACCOUNT_SID, env.TWILIO_API_SECRET || env.TWILIO_AUTH_TOKEN, { accountSid: env.TWILIO_ACCOUNT_SID });
const map = c.sync.v1.services(env.TWILIO_SYNC_SERVICE_SID).syncMaps('sessions');
const items = await map.syncMapItems.list({ limit: 100 });
for (const it of items) {
  const d = it.data;
  if (d.id !== '2993020a-dfec-4f6b-b25a-ee5b04415f08') continue;
  console.log('key', it.key, 'ambientSound was:', JSON.stringify(d.relay?.ambientSound), 'gain', d.relay?.ambientSoundGain);
  if (process.env.APPLY !== '1') { console.log('(dry run)'); break; }
  const relay = { ...(d.relay ?? {}) };
  relay.ambientSound = '';
  await map.syncMapItems(it.key).update({ data: { ...d, relay }, ifMatch: it.revision });
  const after = await map.syncMapItems(it.key).fetch();
  console.log('ambientSound now:', JSON.stringify(after.data.relay?.ambientSound));
}
