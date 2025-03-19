// ui-controller.js
import walletService from './wallet-service.js';

class UIController {
    constructor() {
        this.elements = {};
        this.isLoading = false;
    }

    initialize() {
        // Cache DOM elements
        this.cacheElements();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize UI state
        this.updateUIState();
    }

    cacheElements() {
        // Wallet connection elements
        this.elements.connectButton = document.getElementById('connect-wallet');
        this.elements.disconnectButton = document.getElementById('disconnect-wallet');
        this.elements.walletStatus = document.getElementById('wallet-status');
        this.elements.walletAddress = document.getElementById('wallet-address');
        this.elements.manaDisplay = document.getElementById('mana-display');
        
        // Token interaction elements
        this.elements.contractInput = document.getElementById('contract-address');
        this.elements.balanceButton = document.getElementById('check-balance');
        this.elements.balanceDisplay = document.getElementById('token-balance');
        
        // Loader element
        this.elements.loader = document.getElementById('loader');
    }

    setupEventListeners() {
        // Wallet connection events
        this.elements.connectButton.addEventListener('click', () => this.connectWallet());
        this.elements.disconnectButton.addEventListener('click', () => this.disconnectWallet());
        
        // Token interaction events
        if (this.elements.balanceButton) {
            this.elements.balanceButton.addEventListener('click', () => this.checkBalance());
        }
    }

    updateUIState() {
        const isConnected = walletService.isConnected();
        
        // Update connection status elements
        this.elements.connectButton.style.display = isConnected ? 'none' : 'block';
        this.elements.disconnectButton.style.display = isConnected ? 'block' : 'none';
        this.elements.walletStatus.textContent = isConnected ? 'Connected' : 'Not Connected';
        this.elements.walletStatus.className = isConnected ? 'status connected' : 'status disconnected';
        
        if (isConnected) {
            this.elements.walletAddress.textContent = walletService.formatAddress();
            // Enable token interaction elements
            this.elements.balanceButton.disabled = false;
            
            // Update mana display
            this.updateManaDisplay();
        } else {
            this.elements.walletAddress.textContent = 'Connect your wallet';
            this.elements.manaDisplay.textContent = '';
            this.elements.balanceDisplay.textContent = '';
            
            // Disable token interaction elements
            this.elements.balanceButton.disabled = true;
        }
    }

    async connectWallet() {
        this.showLoader('Connecting to wallet...');
        
        try {
            await walletService.connect();
            this.updateUIState();
            this.showMessage('Wallet connected successfully!', 'success');
        } catch (error) {
            this.showMessage(`Failed to connect wallet: ${error.message}`, 'error');
        } finally {
            this.hideLoader();
        }
    }

    disconnectWallet() {
        walletService.disconnect();
        this.updateUIState();
        this.showMessage('Wallet disconnected', 'info');
    }

    async checkBalance() {
        const contractAddress = this.elements.contractInput.value.trim();
        
        if (!contractAddress) {
            this.showMessage('Please enter a contract address', 'warning');
            return;
        }
        
        this.showLoader('Checking balance...');
        
        try {
            const balance = await walletService.getBalance(contractAddress);
            this.elements.balanceDisplay.textContent = `Balance: ${this.formatNumber(balance)}`;
        } catch (error) {
            this.showMessage(`Error checking balance: ${error.message}`, 'error');
            this.elements.balanceDisplay.textContent = 'Balance: Error';
        } finally {
            this.hideLoader();
        }
    }

    updateManaDisplay() {
        // Simple implementation to avoid errors
        if (this.elements.manaDisplay) {
            // In a complete implementation, this would display the wallet's mana
            this.elements.manaDisplay.textContent = 'Mana data unavailable';
        }
    }

    showLoader(message = 'Loading...') {
        this.isLoading = true;
        this.elements.loader.textContent = message;
        this.elements.loader.style.display = 'flex';
    }

    hideLoader() {
        this.isLoading = false;
        this.elements.loader.style.display = 'none';
    }

    showMessage(message, type = 'info') {
        // Create message element
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.textContent = message;
        
        // Add to document
        document.body.appendChild(messageElement);
        
        // Remove after 5 seconds
        setTimeout(() => {
            messageElement.classList.add('fade-out');
            setTimeout(() => {
                document.body.removeChild(messageElement);
            }, 500);
        }, 5000);
    }

    formatNumber(num) {
        // Format large numbers with commas
        return new Intl.NumberFormat().format(num);
    }
}

export default new UIController();