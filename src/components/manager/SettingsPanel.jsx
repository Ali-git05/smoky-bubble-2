import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

export default function SettingsPanel({ settings, onClose, inline = false }) {
  const [shopName, setShopName] = useState(settings.shopName)
  const [maxPunches, setMaxPunches] = useState(settings.maxPunches)
  const [rewardMessage, setRewardMessage] = useState(settings.rewardMessage)
  const [vapeTiers, setVapeTiers] = useState(
    settings.vapeTiers || { threshold: 20, tier1: 'Free vape under $20', tier2: 'Free premium vape' }
  )
  const [rewardTiers, setRewardTiers] = useState(settings.rewardTiers)
  const [vipThreshold, setVipThreshold] = useState(settings.vipThreshold)
  const [vipMessage, setVipMessage] = useState(settings.vipMessage)
  const [pointsTiers, setPointsTiers] = useState(settings.pointsTiers || [])
  const [qrCodeUrl, setQrCodeUrl] = useState(settings.qrCodeUrl || '')
  const [managerPassword, setManagerPassword] = useState(settings.managerPassword || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [blastMessage, setBlastMessage] = useState('')
  const [optedInCount, setOptedInCount] = useState(null)
  const [blastSending, setBlastSending] = useState(false)
  const [blastResult, setBlastResult] = useState(null)
  const blastResultTimer = useRef(null)
  const [testPhone, setTestPhone] = useState('')
  const [testSending, setTestSending] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const testResultTimer = useRef(null)

  useEffect(() => {
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('sms_opt_in', true)
      .then(({ count }) => setOptedInCount(count ?? 0))
  }, [])

  useEffect(() => {
    setShopName(settings.shopName)
    setMaxPunches(settings.maxPunches)
    setRewardMessage(settings.rewardMessage)
    setVapeTiers(settings.vapeTiers || { threshold: 20, tier1: 'Free vape under $20', tier2: 'Free premium vape' })
    setRewardTiers(settings.rewardTiers)
    setVipThreshold(settings.vipThreshold)
    setVipMessage(settings.vipMessage)
    setPointsTiers(settings.pointsTiers || [])
    setQrCodeUrl(settings.qrCodeUrl || '')
    setManagerPassword(settings.managerPassword || '')
  }, [settings])

  async function handleTestSend() {
    if (!blastMessage.trim() || !testPhone.trim()) return
    setTestSending(true)
    setTestResult(null)
    clearTimeout(testResultTimer.current)

    try {
      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testPhone.trim(),
          message: blastMessage.trim() + '\n\nReply STOP to opt out',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unknown error')
      setTestResult({ success: true })
    } catch (err) {
      setTestResult({ success: false, error: err.message })
    } finally {
      setTestSending(false)
      testResultTimer.current = setTimeout(() => setTestResult(null), 5000)
    }
  }

  async function handleBlast() {
    if (!blastMessage.trim()) return
    const confirmed = window.confirm(
      `Send this message to ${optedInCount} opted-in customer${optedInCount !== 1 ? 's' : ''}?\n\n"${blastMessage.trim()}\n\nReply STOP to opt out"`
    )
    if (!confirmed) return

    setBlastSending(true)
    setBlastResult(null)
    clearTimeout(blastResultTimer.current)

    try {
      const res = await fetch('/api/send-blast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: blastMessage.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unknown error')
      setBlastResult({ success: true, sent: data.sent, failed: data.failed })
      setBlastMessage('')
    } catch (err) {
      setBlastResult({ success: false, error: err.message })
    } finally {
      setBlastSending(false)
      blastResultTimer.current = setTimeout(() => setBlastResult(null), 6000)
    }
  }

  async function handleSave() {
    setSaving(true)
    const pairs = [
      ['shop_name', shopName],
      ['max_punches', String(maxPunches)],
      ['reward_message', rewardMessage],
      ['vape_tiers', JSON.stringify(vapeTiers)],
      ['reward_tiers', JSON.stringify(rewardTiers)],
      ['vip_threshold', String(vipThreshold)],
      ['vip_message', vipMessage],
      ['points_tiers', JSON.stringify(pointsTiers)],
      ['qr_code_url', qrCodeUrl],
      ['manager_password', managerPassword],
    ]
    await Promise.all(
      pairs.map(([key, value]) =>
        supabase.from('settings').upsert({ key, value }, { onConflict: 'key' })
      )
    )
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const inp = 'bg-gray-50 text-gray-900 px-3 py-3 rounded-xl w-full outline-none border border-gray-200 focus:border-gray-400 text-sm'
  const lbl = 'text-gray-500 text-xs uppercase tracking-wider block mb-1.5'
  const sec = 'text-gray-400 text-xs uppercase tracking-wider mb-4'

  const formBody = (
    <>
    <div className="p-6 space-y-8">

          <section>
            <p className={sec}>Shop Info</p>
            <div className="space-y-3">
              <div>
                <label className={lbl}>Shop Name</label>
                <input type="text" value={shopName} onChange={e => setShopName(e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Rewards Manager PIN</label>
                <input
                  type="password"
                  value={managerPassword}
                  onChange={e => setManagerPassword(e.target.value)}
                  placeholder="Leave blank for no PIN"
                  className={inp + ' placeholder:text-gray-300'}
                />
                <p className="text-gray-300 text-xs mt-1.5">Staff must enter this PIN to access Rewards Manager. Leave blank to disable.</p>
              </div>
              <div>
                <label className={lbl}>Customer QR Code Link (shown on check-in screen)</label>
                <input type="url" value={qrCodeUrl} onChange={e => setQrCodeUrl(e.target.value)} placeholder="https://g.page/r/your-google-review-link" className={inp + ' placeholder:text-gray-300'} />
                <p className="text-gray-300 text-xs mt-1.5">Paste any link (Google review, Instagram, etc.) — a QR code will appear on the customer screen.</p>
              </div>
            </div>
          </section>

          <section>
            <p className={sec}>Punch Card</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Punches to Earn Reward</label>
                <input type="number" value={maxPunches} onChange={e => setMaxPunches(Math.max(1, Number(e.target.value)))} min="1" max="20" className={inp} />
              </div>
              <div>
                <label className={lbl}>Default Reward Message</label>
                <input type="text" value={rewardMessage} onChange={e => setRewardMessage(e.target.value)} className={inp} />
              </div>
            </div>
          </section>

          <section>
            <p className={sec}>Vape Purchase Tiers</p>
            <div className="space-y-3">
              <div>
                <label className={lbl}>Price Threshold ($)</label>
                <input
                  type="number"
                  value={vapeTiers.threshold}
                  onChange={e => setVapeTiers(t => ({ ...t, threshold: Math.max(1, Number(e.target.value)) }))}
                  min="1"
                  className={inp}
                  style={{ maxWidth: 120 }}
                />
                <p className="text-gray-300 text-xs mt-1.5">Under = Tier 1 · At or above = Tier 2</p>
              </div>
              <div>
                <label className={lbl}>Tier 1 Name (Under ${vapeTiers.threshold})</label>
                <input type="text" value={vapeTiers.tier1} onChange={e => setVapeTiers(t => ({ ...t, tier1: e.target.value }))} className={inp} />
              </div>
              <div>
                <label className={lbl}>Tier 2 Name (${vapeTiers.threshold} and over)</label>
                <input type="text" value={vapeTiers.tier2} onChange={e => setVapeTiers(t => ({ ...t, tier2: e.target.value }))} className={inp} />
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <p className={sec} style={{ marginBottom: 0 }}>Punch Card Reward Tiers</p>
              <button
                onClick={() => setRewardTiers(ts => [...ts, { name: '', threshold: 1 }])}
                className="text-amber-500 text-sm hover:text-amber-600 transition-colors"
              >
                + Add Tier
              </button>
            </div>
            <p className="text-gray-300 text-xs mb-3">Assign a reward on the Nth punch-card completion.</p>
            {rewardTiers.map((tier, i) => (
              <div key={i} className="flex gap-2 items-center bg-gray-50 rounded-xl p-3 mb-2 border border-gray-100">
                <input
                  type="text"
                  value={tier.name}
                  onChange={e => setRewardTiers(ts => ts.map((t, j) => j === i ? { ...t, name: e.target.value } : t))}
                  placeholder="Reward name"
                  className={inp + ' flex-1 placeholder:text-gray-300'}
                />
                <span className="text-gray-400 text-xs whitespace-nowrap">at card #</span>
                <input
                  type="number"
                  value={tier.threshold}
                  onChange={e => setRewardTiers(ts => ts.map((t, j) => j === i ? { ...t, threshold: Math.max(1, Number(e.target.value)) } : t))}
                  min="1"
                  className="bg-white text-gray-900 px-2 py-2.5 rounded-xl w-16 outline-none border border-gray-200 text-sm text-center"
                />
                <button onClick={() => setRewardTiers(ts => ts.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-400 text-xl leading-none">✕</button>
              </div>
            ))}
          </section>

          <section>
            <p className={sec}>VIP Settings</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>VIP Threshold (visits)</label>
                <input type="number" value={vipThreshold} onChange={e => setVipThreshold(Math.max(1, Number(e.target.value)))} min="1" className={inp} />
              </div>
              <div>
                <label className={lbl}>VIP Welcome Message</label>
                <input type="text" value={vipMessage} onChange={e => setVipMessage(e.target.value)} className={inp} />
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <p className={sec} style={{ marginBottom: 0 }}>Points Gift Tiers</p>
              <button
                onClick={() => setPointsTiers(ts => [...ts, { threshold: 100, message: '' }])}
                className="text-amber-500 text-sm hover:text-amber-600 transition-colors"
              >
                + Add Tier
              </button>
            </div>
            <p className="text-gray-300 text-xs mb-3">Show a gift message when a customer's total points reach a threshold.</p>
            {pointsTiers.map((tier, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-3 mb-2 space-y-2 border border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-xs">At</span>
                  <input
                    type="number"
                    value={tier.threshold}
                    onChange={e => setPointsTiers(ts => ts.map((t, j) => j === i ? { ...t, threshold: Math.max(1, Number(e.target.value)) } : t))}
                    min="1"
                    className="bg-white text-gray-900 px-2 py-2 rounded-lg w-24 outline-none border border-gray-200 text-sm text-center"
                  />
                  <span className="text-gray-400 text-xs">points</span>
                  <button onClick={() => setPointsTiers(ts => ts.filter((_, j) => j !== i))} className="ml-auto text-gray-300 hover:text-red-400 text-xl leading-none">✕</button>
                </div>
                <input
                  type="text"
                  value={tier.message}
                  onChange={e => setPointsTiers(ts => ts.map((t, j) => j === i ? { ...t, message: e.target.value } : t))}
                  placeholder="Gift message shown to customer…"
                  className={inp + ' placeholder:text-gray-300'}
                />
              </div>
            ))}
          </section>

          <section>
            <p className={sec}>Blast Message</p>
            <p className="text-gray-300 text-xs mb-3">
              Type any message — the opt-out footer is added automatically. Only sent to opted-in customers.
            </p>

            <div className="relative">
              <textarea
                value={blastMessage}
                onChange={e => setBlastMessage(e.target.value)}
                placeholder="Hey Smoky Bubble fam! Come in this weekend for a special deal…"
                rows={4}
                className={inp + ' resize-none placeholder:text-gray-300'}
              />
              <span className={`absolute bottom-2.5 right-3 text-xs ${
                (blastMessage.length + 26) > 320 ? 'text-red-400' :
                (blastMessage.length + 26) > 160 ? 'text-amber-400' : 'text-gray-300'
              }`}>
                {blastMessage.length + 26}/160
              </span>
            </div>

            {blastMessage.trim() && (
              <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-600 whitespace-pre-wrap">
                {blastMessage.trim()}
                {'\n\n'}
                <span className="text-gray-400">Reply STOP to opt out</span>
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <input
                type="tel"
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
                placeholder="Test number (e.g. 5551234567)"
                className={inp + ' flex-1'}
              />
              <button
                onClick={handleTestSend}
                disabled={testSending || !blastMessage.trim() || !testPhone.trim()}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-40 text-sm whitespace-nowrap"
              >
                {testSending ? 'Sending…' : 'Send Test'}
              </button>
            </div>

            {testResult && (
              <div className={`mt-2 rounded-xl px-4 py-2.5 text-sm font-medium ${
                testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
              }`}>
                {testResult.success ? 'Test message sent!' : `Error: ${testResult.error}`}
              </div>
            )}

            {blastResult && (
              <div className={`mt-3 rounded-xl px-4 py-3 text-sm font-medium ${
                blastResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
              }`}>
                {blastResult.success
                  ? `Sent to ${blastResult.sent} customer${blastResult.sent !== 1 ? 's' : ''}${blastResult.failed > 0 ? ` · ${blastResult.failed} failed` : ''}`
                  : `Error: ${blastResult.error}`}
              </div>
            )}

            <button
              onClick={handleBlast}
              disabled={blastSending || !blastMessage.trim() || optedInCount === 0}
              className="mt-3 w-full bg-gray-900 hover:bg-gray-700 text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-40 text-sm"
            >
              {blastSending
                ? 'Sending…'
                : `Send to ${optedInCount === null ? '…' : optedInCount} opted-in customer${optedInCount !== 1 ? 's' : ''}`}
            </button>
          </section>

        </div>

        <div className="p-6 border-t border-gray-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-amber-500 hover:bg-amber-400 text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50 text-base"
          >
            {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
    </>
  )

  if (inline) {
    return (
      <div className="max-w-xl mx-auto py-4">
        {formBody}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto border border-gray-200 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-gray-900 font-bold text-xl">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">✕</button>
        </div>
        {formBody}
      </div>
    </div>
  )
}
