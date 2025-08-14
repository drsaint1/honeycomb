// Debug script to help identify browser extension conflicts
(function() {
  'use strict';
  
  console.log('🔍 Debugging browser environment...');
  
  // Check for common extension indicators
  const extensionIndicators = [
    'chrome.runtime',
    'browser.runtime',
    '__REACT_DEVTOOLS_GLOBAL_HOOK__',
    '__REDUX_DEVTOOLS_EXTENSION__',
    'metamask',
    'ethereum',
    'solana',
    'phantom',
    'solflare'
  ];
  
  extensionIndicators.forEach(indicator => {
    if (window[indicator]) {
      console.log(`✅ Found: window.${indicator}`);
    }
  });
  
  // Check for content scripts
  const scripts = Array.from(document.scripts);
  const extensionScripts = scripts.filter(script => 
    script.src && (script.src.includes('extension://') || script.src.includes('moz-extension://'))
  );
  
  if (extensionScripts.length > 0) {
    console.log('🔌 Extension scripts detected:', extensionScripts.map(s => s.src));
  }
  
  // Monitor for DOM modifications by extensions
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            // Check if added by extension
            if (element.className && element.className.includes('extension-')) {
              console.log('🔌 Extension DOM modification detected:', element);
            }
          }
        });
      }
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Override console.error to catch extension errors
  const originalError = console.error;
  console.error = function(...args) {
    if (args.some(arg => 
      typeof arg === 'string' && (
        arg.includes('content.bundle.js') || 
        arg.includes('Assignment to constant variable')
      )
    )) {
      console.log('🚨 Extension-related error detected:', ...args);
      // Don't propagate extension errors that might break the app
      return;
    }
    originalError.apply(console, args);
  };
  
  console.log('✅ Debug script loaded. Monitoring for extension conflicts...');
})();