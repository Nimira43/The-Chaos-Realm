import { Link } from 'react-router-dom'

export default function EditorShell({ title, subtitle, actions, children }) {
  return (
    <div className='editor-shell'>
      <header className='editor-header'>
        <Link to='/' className='editor-back'>
          ‹ Home
        </Link>

        <h1 className='editor-title'>{title}</h1>
        {subtitle && <span className='editor-subtitle'>{subtitle}</span>}

        <div className='editor-header-spacer' />

        {actions && <div className='editor-actions'>{actions}</div>}
      </header>

      {children}
    </div>
  )
}
