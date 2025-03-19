// app.js
import uiController from './ui-controller.js';
import kondorInitializer from './kondor-init.js';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the UI controller
    uiController.initialize();
    
    // Listen for Kondor availability
    kondorInitializer.onStatusChange((isAvailable) => {
        if (!isAvailable) {
            uiController.showMessage('Kondor wallet extension not detected. Please install it to use this dApp.', 'warning');
            
            // Check if connect button exists before disabling
            const connectButton = document.getElementById('connect-wallet');
            if (connectButton) {
                connectButton.disabled = true;
            }
        } else {
            uiController.showMessage('Kondor wallet detected!', 'info');
        }
    });
    
    // Register service worker if available
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/third-dapp/js/service-worker.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(error => {
                    console.log('ServiceWorker registration failed: ', error);
                });
        });
    }
});