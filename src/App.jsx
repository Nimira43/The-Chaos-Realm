import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import GameEngine from './pages/GameEngine'
import MapEditor from './pages/MapEditor'
import WizardEditor from './pages/WizardEditor'
import BackgroundMusicPlayer from './audio/BackgroundMusicPlayer'
import GameModes from './pages/GameModes'

export default function App() {
  return (
    <BrowserRouter>
      <BackgroundMusicPlayer />
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/game-modes' element={<GameModes />} />
        <Route path='/game' element={<GameEngine />} />
        <Route path='/map-editor' element={<MapEditor />} />
        <Route path='/wizard-editor' element={<WizardEditor />} />
      </Routes>
    </BrowserRouter>
  )
}
