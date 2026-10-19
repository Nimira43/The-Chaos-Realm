import { useState } from 'react'
import EditorShell from '../ui/EditorShell.jsx'

const TABS = ['Stats', 'Spellbook', 'Creatures', 'Inventory']

export default function WizardEditor() {
  const [tab, setTab] = useState('Stats')

  return (
    <EditorShell
      title='Wizard Editor'
      subtitle='Player & enemy'
      actions={
        <>
          <button className='btn btn-ghost' disabled>
            Load
          </button>
          <button className='btn btn-primary' disabled>
            Save
          </button>
        </>
      }
    >
      <div className='wizard-body'>
        <aside className='wizard-column left'>
          <section>
            <h2 className='panel-title'>Wizard</h2>
            <div className='tool-row'>
              <button className='btn btn-primary'>Player</button>
              <button className='btn'>Enemy</button>
            </div>
          </section>

          <section>
            <h2 className='panel-title'>Identity</h2>
            <div className='field'>
              <label htmlFor='wizard-name'>Name</label>
              <input id='wizard-name' placeholder='Wizard' disabled />
            </div>
          </section>

          <section>
            <h2 className='panel-title'>Core stats</h2>
            <p className='help-text'>
              Health, mana, action points and carry limit will be edited here.
            </p>
          </section>
        </aside>

        <main className='wizard-stage'>
          <div className='tabs'>
            {TABS.map((t) => (
              <button
                key={t}
                className={`tab ${tab === t ? 'active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className='empty-state'>
            <strong>{tab}</strong>
            <span>The {tab.toLowerCase()} editor is coming soon.</span>
          </div>
        </main>

        <aside className='wizard-column right'>
          <section>
            <h2 className='panel-title'>Preview</h2>
            <div className='empty-state'>
              <span>Hover card preview</span>
            </div>
          </section>
        </aside>
      </div>
    </EditorShell>
  )
}
