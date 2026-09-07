'use client';

import { useEffect } from 'react';

export default function Coframe() {
  // Send page hydrated event
  useEffect(() => {
    window.CFQ = window.CFQ || [];
    window.CFQ.push({ pageHydrated: true });
  }, []);

  return (
    <script
      id="coframe-installation-script"
      dangerouslySetInnerHTML={{
        __html: `
(function () {
    // Early exit for performance testing
    if (/cf_disable/.test(location.search)) return console.warn('[Coframe] Disabled via URL parameter');
    
    // Coframe config
    const config = {
      projectId: '6a9e31bb82444fc48fd16faf',
      startTime: Date.now(),
      timeoutMs: 1000,
      currentUrl: window.location.href,
      referrer: document.referrer,
      waitForHydration: true, // NOTE: Wait for hydration before applying changes
    };

    // Prevent duplicate installation
    const script_id = 'coframe-sdk-js';
    if (document.getElementById(script_id)) return console.warn('[Coframe] SDK already installed');
    
    // Coframe queue setup
    (window.CFQ = window.CFQ || []).push({ config });

    // Coframe antiflicker CSS
    // Body mode hides the full page until Coframe reveal
    const style = document.createElement('style');
    style.id = 'coframe-antiflicker';
    
    style.textContent = ':root { --cf-show: 0; } body { opacity: var(--cf-show) !important; transition: opacity 0.2s ease; }'
    
    function hide() { document.head.appendChild(style); }
    function show() {
      document.documentElement.style.setProperty('--cf-show','1');
      style.parentNode && style.parentNode.removeChild(style);
    }
    hide(); setTimeout(show, config.timeoutMs);
    
    // Coframe SDK JS
    var edgeUrl = new URL('https://edge.cofra.me/cf.js');
    edgeUrl.searchParams.set('config', encodeURIComponent(JSON.stringify(config)));

    const script = document.createElement('script');
    script.id = script_id;
    script.async = true;
    script.src = edgeUrl.toString();
    
    script.onerror = () => { show(); console.error('[Coframe] SDK failed to load'); };
    document.head.appendChild(script);
})();
`,
      }}
    />
  );
}
