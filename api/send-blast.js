import twilio from 'twilio'
import { createClient } from '@supabase/supabase-js'

const OPT_OUT_FOOTER = '\n\nReply STOP to opt out'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { message } = req.body
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Missing message' })
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!accountSid || !authToken || !from) {
    return res.status(500).json({ error: 'Twilio credentials not configured' })
  }
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase credentials not configured' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data: customers, error } = await supabase
    .from('customers')
    .select('phone')
    .eq('sms_opt_in', true)

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch customers: ' + error.message })
  }
  if (!customers || customers.length === 0) {
    return res.status(200).json({ sent: 0, failed: 0, errors: [] })
  }

  const client = twilio(accountSid, authToken)
  const body = message.trim() + OPT_OUT_FOOTER

  let sent = 0
  let failed = 0
  const errors = []

  for (const customer of customers) {
    const digits = customer.phone.replace(/\D/g, '')
    const to = digits.length === 10 ? `+1${digits}` : `+${digits}`

    try {
      await client.messages.create({ from, to, body })
      sent++
    } catch (err) {
      failed++
      errors.push({ phone: customer.phone, error: err.message })
    }

    // 100ms delay between sends to avoid carrier flagging
    await sleep(100)
  }

  return res.status(200).json({ sent, failed, errors })
}
