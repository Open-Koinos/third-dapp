// app.js
import uiController from './app-controller.js';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the UI controller
    uiController.initialize();
    
    // Check if the Kondor wallet is available
    if (typeof window.kondor === 'undefined') {
        uiController.showMessage('Kondor wallet extension not detected. Please install it to use this dApp.', 'warning');
        
        // Disable the connect button if it exists
        const connectButton = document.getElementById('connect-wallet');
        if (connectButton) {
            connectButton.disabled = true;
        }
    }
});