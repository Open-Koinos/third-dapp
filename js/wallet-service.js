// Completely revised wallet-service.js
const WALLET_STORAGE_KEY = 'third_dapp_wallet';

class WalletService {
    constructor() {
        // Reference to the kondor object injected by the extension
        this.kondor = window.kondor;
        this.walletAddress = this.getStoredWallet();
    }

    // Connect to wallet and get accounts
    async connect() {
        try {
            if (!this.kondor) {
                throw new Error('Kondor wallet extension not detected');
            }

            const accounts = await this.kondor.getAccounts();
            
            if (!Array.isArray(accounts) || accounts.length === 0) {
                throw new Error('No accounts found in Kondor wallet');
            }

            this.walletAddress = accounts[0].address;
            this.storeWallet(this.walletAddress);
            
            return this.walletAddress;
        } catch (error) {
            console.error('Error connecting to Kondor wallet:', error);
            this.disconnect();
            throw error;
        }
    }

    // Get token balance using direct API call
    async getBalance(contractAddress) {
        try {
            if (!this.walletAddress) {
                throw new Error('No wallet connected');
            }

            // Using the Koinos API directly
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

    // Disconnect wallet
    disconnect() {
        this.walletAddress = null;
        this.clearStoredWallet();
    }

    // Check if wallet is connected
    isConnected() {
        return !!this.walletAddress;
    }

    // Store wallet address in localStorage
    storeWallet(address) {
        try {
            localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(address));
        } catch (error) {
            console.error('Error storing wallet address:', error);
        }
    }

    // Get stored wallet address from localStorage
    getStoredWallet() {
        try {
            return JSON.parse(localStorage.getItem(WALLET_STORAGE_KEY) || 'null');
        } catch (error) {
            console.error('Error retrieving wallet address:', error);
            return null;
        }
    }

    // Clear stored wallet address
    clearStoredWallet() {
        try {
            localStorage.removeItem(WALLET_STORAGE_KEY);
        } catch (error) {
            console.error('Error clearing wallet address:', error);
        }
    }

    // Format address for display (e.g., "123456...7890")
    formatAddress(address = this.walletAddress) {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.slice(-4)}`;
    }
}

export default new WalletService();