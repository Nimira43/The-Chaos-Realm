import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import GameEngine from './pages/GameEngine'
import MapEditor from './pages/MapEditor'
import WizardEditor from './pages/WizardEditor'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/game' element={<GameEngine />} />
        <Route path='/map-editor' element={<MapEditor />} />
        <Route path='/wizard-editor' element={<WizardEditor />} />
      </Routes>
    </BrowserRouter>
  )
}
