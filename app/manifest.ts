import type { MetadataRoute } from 'next';

/**
 * Web app manifest: lets Chrome on the Android tablets "Install app" / "Add to Home screen",
 * which launches straight into the participant app in fullscreen portrait.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'STAR Lab Study',
    short_name: 'STAR Lab',
    description: 'Participant app for short-form video studies',
    start_url: '/tablet',
    scope: '/tablet',
    display: 'fullscreen',
    orientation: 'portrait',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
