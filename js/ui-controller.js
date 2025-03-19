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
        
        // Token interaction elements
        this.elements.contractInput = document.getElementById('contract-address');
        this.elements.balanceButton = document.getElementById('check-balance');
        this.elements.balanceDisplay = document.getElementById('token-balance');
        
        // Loader element
        this.elements.loader = document.getElementById('loader');
    }

    setupEventListeners() {
        // Wallet connection events
        if (this.elements.connectButton) {
            this.elements.connectButton.addEventListener('click', () => this.connectWallet());
        }
        
        if (this.elements.disconnectButton) {
            this.elements.disconnectButton.addEventListener('click', () => this.disconnectWallet());
        }
        
        // Token interaction events
        if (this.elements.balanceButton) {
            this.elements.balanceButton.addEventListener('click', () => this.checkBalance());
        }
    }

    updateUIState() {
        const isConnected = walletService.isConnected();
        
        // Update connection status elements
        if (this.elements.connectButton && this.elements.disconnectButton) {
            this.elements.connectButton.style.display = isConnected ? 'none' : 'block';
            this.elements.disconnectButton.style.display = isConnected ? 'block' : 'none';
        }
        
        if (this.elements.walletStatus) {
            this.elements.walletStatus.textContent = isConnected ? 'Connected' : 'Not Connected';
            this.elements.walletStatus.className = isConnected ? 'status connected' : 'status disconnected';
        }
        
        if (isConnected) {
            if (this.elements.walletAddress) {
                this.elements.walletAddress.textContent = walletService.formatAddress();
            }
            
            // Enable token interaction elements
            if (this.elements.balanceButton) {
                this.elements.balanceButton.disabled = false;
            }
            
        } else {
            if (this.elements.walletAddress) {
                this.elements.walletAddress.textContent = 'Connect your wallet';
            }
            
            if (this.elements.balanceDisplay) {
                this.elements.balanceDisplay.textContent = '';
            }
            
            // Disable token interaction elements
            if (this.elements.balanceButton) {
                this.elements.balanceButton.disabled = true;
            }
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
            console.error('Connection error:', error);
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
        if (!this.elements.contractInput) {
            this.showMessage('Contract input field not found', 'error');
            return;
        }
        
        const contractAddress = this.elements.contractInput.value.trim();
        
        if (!contractAddress) {
            this.showMessage('Please enter a contract address', 'warning');
            return;
        }
        
        this.showLoader('Checking balance...');
        
        try {
            const balance = await walletService.getBalance(contractAddress);
            if (this.elements.balanceDisplay) {
                this.elements.balanceDisplay.textContent = `Balance: ${this.formatNumber(balance)}`;
            }
        } catch (error) {
            this.showMessage(`Error checking balance: ${error.message}`, 'error');
            if (this.elements.balanceDisplay) {
                this.elements.balanceDisplay.textContent = 'Balance: Error';
            }
        } finally {
            this.hideLoader();
        }
    }

    showLoader(message = 'Loading...') {
        this.isLoading = true;
        if (this.elements.loader) {
            this.elements.loader.textContent = message;
            this.elements.loader.style.display = 'flex';
        }
    }

    hideLoader() {
        this.isLoading = false;
        if (this.elements.loader) {
            this.elements.loader.style.display = 'none';
        }
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