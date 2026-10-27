import { lazy, Suspense, useState } from 'react';
import { useRive } from '@rive-app/react-canvas';

const logo = '/logo.png';
// WebGL basketball, loaded only when shown so the main bundle stays small.
const Basketball3D = lazy(() => import('./Basketball3D.jsx'));

// Plays /animations/loader.riv when the file exists. Otherwise shows the 3D ball.
function RiveMark({ onFail }) {
  const { RiveComponent } = useRive({ src: '/animations/loader.riv', autoplay: true, onLoadError: onFail });
  return <RiveComponent className="loader-rive" />;
}

export function Loader() {
  const [riveFailed, setRiveFailed] = useState(false);
  return (
    <div className="loader" role="status" aria-label="Loading dashboard">
      <div className="loader-art">
        {riveFailed ? (
          <Suspense fallback={<img src={logo} alt="" className="loader-logo" />}>
            <Basketball3D />
          </Suspense>
        ) : (
          <RiveMark onFail={() => setRiveFailed(true)} />
        )}
      </div>
      <p>Loading the club…</p>
    </div>
  );
}
