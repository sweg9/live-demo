import { lazy, Suspense, useEffect, useState, type ComponentProps } from 'react'
import { HomeMap } from './HomeMap'
import type { Source } from './HomeMap3D'
import { TEXTURED_URL } from './urls'

// The map with a 2D / 3D switch, and in 3D a choice of what to show: the clean model (default),
// the raw scan, or the photo-textured scan (only on the owner's computer, C-05). Pages pass the
// same props either way. The 3D view and three.js load only when 3D is chosen. Without WebGL
// (old browsers, tests) only 2D is offered.

const HomeMap3D = lazy(() => import('./HomeMap3D'))
type Props = ComponentProps<typeof HomeMap>
type Mode = '2d' | '3d'

const KEY = 'nova.mapView' // display preferences only
const SOURCE_KEY = 'nova.mapSource'
const hasWebGL = () => typeof window !== 'undefined' && 'WebGL2RenderingContext' in window

export function MapView(props: Props) {
  const [mode, setMode] = useState<Mode>(() => (hasWebGL() ? ((localStorage.getItem(KEY) as Mode) ?? '3d') : '2d'))
  const [source, setSource] = useState<Source>(() => (localStorage.getItem(SOURCE_KEY) as Source) ?? 'model')
  const photo = usePhotoAvailable()
  const shown: Source = source === 'photo' && !photo ? 'model' : source

  const pickMode = (m: Mode) => {
    setMode(m)
    localStorage.setItem(KEY, m)
  }
  const pickSource = (s: Source) => {
    setSource(s)
    localStorage.setItem(SOURCE_KEY, s)
  }

  return (
    <div className="map-view">
      {hasWebGL() && (
        <div className="map-switch" role="group" aria-label="Map view">
          <button type="button" aria-pressed={mode === '2d'} onClick={() => pickMode('2d')}>2D</button>
          <button type="button" aria-pressed={mode === '3d'} onClick={() => pickMode('3d')}>3D</button>
          {mode === '3d' && (
            <>
              <span className="sep" aria-hidden="true" />
              <button type="button" aria-pressed={shown === 'model'} onClick={() => pickSource('model')}>Model</button>
              <button type="button" aria-pressed={shown === 'scan'} onClick={() => pickSource('scan')}>Scan</button>
              {photo && (
                <button type="button" aria-pressed={shown === 'photo'} onClick={() => pickSource('photo')} title="The photo texture exists only on this computer">
                  Photo
                </button>
              )}
            </>
          )}
        </div>
      )}
      {mode === '3d' ? (
        <Suspense fallback={<div className="home-map-3d loading muted">Loading 3D…</div>}>
          <HomeMap3D {...props} source={shown} />
        </Suspense>
      ) : (
        <HomeMap {...props} />
      )}
    </div>
  )
}

/** True when the dev server on the owner's computer serves the textured scan. */
function usePhotoAvailable() {
  const [ok, setOk] = useState(false)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    let live = true
    fetch(TEXTURED_URL, { method: 'HEAD' })
      .then((r) => live && setOk(r.ok))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])
  return ok
}
