import Button from '@/components/Button'

export default function StyleLabPage() {
  return (
    <main className="silo-page px-6 py-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="silo-panel p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] silo-text-soft">Silo Brand Playground</p>
          <h1 className="text-3xl font-bold mt-2 silo-text-main">Style Lab</h1>
          <p className="mt-2 silo-text-soft">Reference page for light and dark visual consistency across shared UI elements.</p>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="silo-panel p-5 space-y-4">
            <h2 className="text-xl font-semibold silo-text-main">Buttons</h2>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" size="sm">Primary</Button>
              <Button variant="secondary" size="sm">Secondary</Button>
              <Button variant="outline" size="sm">Outline</Button>
              <Button variant="destructive" size="sm">Destructive</Button>
              <Button variant="orange" size="sm">Warning</Button>
              <Button variant="ghost" size="sm">Ghost</Button>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" size="sm" disabled>Disabled</Button>
              <Button variant="primaryDark" size="sm">Primary Dark</Button>
              <Button variant="outlineLight" size="sm">Outline Light</Button>
            </div>
          </div>

          <div className="silo-panel p-5 space-y-4">
            <h2 className="text-xl font-semibold silo-text-main">Inputs and Pills</h2>
            <input className="silo-input w-full rounded-xl px-3 py-2" placeholder="Search market..." />
            <textarea className="silo-input w-full rounded-xl px-3 py-2 min-h-20" placeholder="Notes" />
            <div className="flex gap-2 flex-wrap">
              <span className="silo-pill px-3 py-1 text-xs font-medium">Default</span>
              <span className="silo-pill px-3 py-1 text-xs font-medium">Selected</span>
              <span className="silo-pill px-3 py-1 text-xs font-medium">Network: Arbitrum</span>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="silo-panel p-5 space-y-3">
            <h2 className="text-xl font-semibold silo-text-main">Alerts</h2>
            <div className="silo-alert silo-alert-warning">Warning: this action requires wallet confirmation.</div>
            <div className="silo-alert silo-alert-error">Error: network is unsupported for this operation.</div>
          </div>

          <div className="silo-panel p-5 space-y-4">
            <h2 className="text-xl font-semibold silo-text-main">Cards</h2>
            <article className="silo-panel-soft p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] silo-text-faint">Supply APR</p>
              <p className="text-3xl font-bold mt-2 silo-text-main">2.86%</p>
              <p className="mt-2 text-sm silo-text-soft">Deposit into a multi-asset vault and earn from borrowers.</p>
            </article>
          </div>
        </section>

        <section className="silo-panel p-5 space-y-4">
          <h2 className="text-xl font-semibold silo-text-main">Selectable Vault Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <article className="silo-panel silo-top-card silo-selectable-card p-5" data-selected="false">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] silo-text-faint">Current APR</p>
              <p className="text-3xl font-bold mt-2 silo-text-main">1.45%</p>
              <p className="mt-2 text-sm silo-text-soft">ETH multi-asset strategy preview card.</p>
            </article>
            <article className="silo-panel silo-top-card silo-selectable-card p-5" data-selected="true">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] silo-text-faint">Current APR</p>
              <p className="text-3xl font-bold mt-2 silo-text-main">2.86%</p>
              <p className="mt-2 text-sm silo-text-soft">USDC selected state with active border.</p>
            </article>
            <article className="silo-panel silo-top-card silo-selectable-card p-5" data-selected="false">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] silo-text-faint">Current APR</p>
              <p className="text-3xl font-bold mt-2 silo-text-main">3.40%</p>
              <p className="mt-2 text-sm silo-text-soft">Alternative option in non-selected state.</p>
            </article>
          </div>
        </section>

        <section className="silo-panel p-5 space-y-4">
          <h2 className="text-xl font-semibold silo-text-main">Oracle Type Selector</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="silo-choice-option" data-selected="false">
              <span className="silo-choice-radio" aria-hidden />
              <span className="block">
                <span className="font-semibold silo-text-main">Chainlink Oracle</span>
                <span className="block text-sm mt-1 silo-text-soft">Not selected state for option card with radio.</span>
              </span>
            </label>
            <label className="silo-choice-option" data-selected="true">
              <span className="silo-choice-radio" aria-hidden />
              <span className="block">
                <span className="font-semibold silo-text-main">Scaler Oracle</span>
                <span className="block text-sm mt-1 silo-text-soft">Selected state with active border and filled radio dot.</span>
              </span>
            </label>
          </div>
        </section>
      </div>
    </main>
  )
}
