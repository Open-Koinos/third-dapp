// wallet-service.js
const WALLET_STORAGE_KEY = 'third_dapp_wallet';

class WalletService {
    constructor() {
        this.kondor = window.kondor;
        this.walletAddress = this.getStoredWallet();
        this.isInitialized = false;
    }

    // Error handler utility
    handleError(error, context) {
        console.error(`Error ${context}:`, error);
        return error;
    }

    // Initialize check for wallet extension
    initialize() {
        if (typeof window.kondor === 'undefined') {
            console.warn('Kondor wallet extension not detected');
            return false;
        }
        this.isInitialized = true;
        return true;
    }

    // Connect to wallet using a simpler approach
    async connect() {
        try {
            if (!this.isInitialized) {
                if (!this.initialize()) {
                    throw new Error('Kondor wallet not available');
                }
            }

            // Use a try-catch specifically for getAccounts to handle any potential issues
            try {
                const accounts = await this.kondor.getAccounts();
                
                if (!accounts || accounts.length === 0) {
                    throw new Error('No accounts found');
                }

                this.walletAddress = accounts[0].address;
                this.storeWallet(this.walletAddress);
                
                return this.walletAddress;
            } catch (accountError) {
                throw this.handleError(accountError, 'getting accounts');
            }
        } catch (error) {
            throw this.handleError(error, 'connecting to Kondor wallet');
        }
    }

    // Get balance using direct API
    async getBalance(contractAddress) {
        try {
            if (!this.walletAddress) {
                throw new Error('No wallet connected');
            }

            const response = await fetch(`https://api.koinos.io/v1/token/${contractAddress}/balance/${this.walletAddress}`);
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            return data.value || '0';
        } catch (error) {
            console.error('Error getting balance:', error);
            return '0';
        }
    }

    // Get mana (simplified)
    async getMana() {
        try {
            if (!this.walletAddress) {
                return '0';
            }

            const response = await fetch(`https://api.koinos.io/v1/chain/get_account_rc?account=${this.walletAddress}`);
            
            if (!response.ok) {
                return '0';
            }
            
            const data = await response.json();
            return data.rc || '0';
        } catch (error) {
            return '0';
        }
    }

    // Mock sending tokens for now
    async sendTokens(contractAddress, receiverAddress, amount) {
        try {
            if (!this.walletAddress) {
                throw new Error('No wallet connected');
            }
            
            console.log("Transaction Details:", {
                sender: this.walletAddress,
                contract: contractAddress,
                receiver: receiverAddress,
                amount: amount
            });
            
            // Mock transaction for testing
            return {
                transaction: {
                    id: "mock_tx_" + Math.floor(Math.random() * 1000000),
                    status: "success"
                }
            };
        } catch (error) {
            throw this.handleError(error, 'sending tokens');
        }
    }

    // Standard wallet methods
    disconnect() {
        this.walletAddress = null;
        this.clearStoredWallet();
    }

    isConnected() {
        return !!this.walletAddress;
    }

    storeWallet(address) {
        try {
            localStorage.setItem(WALLET_STORAGE_KEY, address);
        } catch (error) {
            console.error('Error storing wallet address:', error);
        }
    }

    getStoredWallet() {
        try {
            return localStorage.getItem(WALLET_STORAGE_KEY) || null;
        } catch (error) {
            console.error('Error retrieving wallet address:', error);
            return null;
        }
    }

    clearStoredWallet() {
        try {
            localStorage.removeItem(WALLET_STORAGE_KEY);
        } catch (error) {
            console.error('Error clearing wallet address:', error);
        }
    }

    formatAddress(address = this.walletAddress) {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.slice(-4)}`;
    }
}

export default new WalletService();