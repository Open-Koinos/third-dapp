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
        this.elements.receiverInput = document.getElementById('receiver-address');
        this.elements.amountInput = document.getElementById('token-amount');
        this.elements.balanceButton = document.getElementById('check-balance');
        this.elements.sendButton = document.getElementById('send-tokens');
        this.elements.balanceDisplay = document.getElementById('token-balance');
        this.elements.transactionStatus = document.getElementById('transaction-status');
        
        // Loader element
        this.elements.loader = document.getElementById('loader');
    }

    setupEventListeners() {
        // Wallet connection events
        this.elements.connectButton.addEventListener('click', () => this.connectWallet());
        this.elements.disconnectButton.addEventListener('click', () => this.disconnectWallet());
        
        // Token interaction events
        this.elements.balanceButton.addEventListener('click', () => this.checkBalance());
        this.elements.sendButton.addEventListener('click', () => this.sendTokens());
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
            this.elements.sendButton.disabled = false;
            
            // Update mana display
            this.updateManaDisplay();
        } else {
            this.elements.walletAddress.textContent = 'Connect your wallet';
            this.elements.manaDisplay.textContent = '';
            this.elements.balanceDisplay.textContent = '';
            
            // Disable token interaction elements
            this.elements.balanceButton.disabled = true;
            this.elements.sendButton.disabled = true;
        }
    }

    async updateManaDisplay() {
        try {
            const mana = await walletService.getMana();
            this.elements.manaDisplay.textContent = `Mana: ${this.formatNumber(mana)}`;
        } catch (error) {
            this.elements.manaDisplay.textContent = 'Mana: Error';
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

    async sendTokens() {
        const contractAddress = this.elements.contractInput.value.trim();
        const receiverAddress = this.elements.receiverInput.value.trim();
        const amount = this.elements.amountInput.value.trim();
        
        if (!contractAddress || !receiverAddress || !amount) {
            this.showMessage('Please fill in all fields', 'warning');
            return;
        }
        
        this.showLoader('Sending tokens...');
        
        try {
            const result = await walletService.sendTokens(contractAddress, receiverAddress, amount);
            
            // Reset input fields
            this.elements.amountInput.value = '';
            
            // Show transaction result
            this.showMessage('Transaction sent successfully!', 'success');
            this.elements.transactionStatus.innerHTML = `
                <div class="transaction-success">
                    <p>Transaction ID: ${result.transaction.id}</p>
                    <p>Click <a href="https://koinscan.io/transaction/${result.transaction.id}" target="_blank">here</a> to view on explorer</p>
                </div>
            `;
            
            // Update balance and mana after transaction
            await this.checkBalance();
            this.updateManaDisplay();
        } catch (error) {
            this.showMessage(`Error sending tokens: ${error.message}`, 'error');
        } finally {
            this.hideLoader();
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