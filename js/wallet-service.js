// wallet-service.js
const WALLET_STORAGE_KEY = 'third_dapp_wallet';

// Polyfill for crypto.randomUUID if needed
if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
    crypto.randomUUID = function() {
        return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    };
    console.log("Added crypto.randomUUID polyfill");
}

class WalletService {
    constructor() {
        // Reference to the kondor object injected by the extension
        this.kondor = window.kondor;
        this.walletAddress = this.getStoredWallet();
        this.signer = null;
        this.accountData = null;
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

            this.accountData = accounts[0];
            this.walletAddress = accounts[0].address;
            this.storeWallet(this.walletAddress);
            
            // Try to get a signer immediately
            await this.getSigner();
            
            return this.walletAddress;
        } catch (error) {
            console.error('Error connecting to Kondor wallet:', error);
            // Clear any stored data on failed connection
            this.disconnect();
            throw error;
        }
    }

    // Get signer for transactions
    async getSigner() {
        try {
            if (!this.walletAddress) {
                throw new Error('No wallet connected');
            }

            this.signer = this.kondor.getSigner(this.walletAddress);
            return this.signer;
        } catch (error) {
            console.error('Error getting signer:', error);
            this.signer = null;
            throw error;
        }
    }

    // Send tokens
    async sendTokens(contractAddress, receiverAddress, amount) {
        try {
            if (!this.walletAddress) {
                throw new Error('No wallet connected');
            }
            
            if (!this.signer) {
                this.signer = this.kondor.getSigner(this.walletAddress);
            }

            // Create a proper transaction for a token transfer
            // This follows standard token contract conventions
            const transaction = {
                operations: [{
                    operation: "transfer",
                    contractId: contractAddress,
                    args: {
                        from: this.walletAddress,
                        to: receiverAddress,
                        value: amount
                    }
                }]
            };

            // Send the transaction using Kondor
            const result = await this.signer.sendTransaction(transaction);
            return result;
        } catch (error) {
            console.error('Error sending tokens:', error);
            throw error;
        }
    }

    // Get token balance
    async getBalance(contractAddress) {
        try {
            if (!this.walletAddress) {
                throw new Error('No wallet connected');
            }
    
            // Using the Koinos API directly - this is what Open-K is doing behind the scenes
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

    // Get available mana
    async getMana() {
        try {
            if (!this.walletAddress) {
                throw new Error('No wallet connected');
            }

            const rc = await this.kondor.provider.getAccountRc(this.walletAddress);
            return rc?.rc || '0';
        } catch (error) {
            console.error('Error getting mana:', error);
            return '0';
        }
    }

    // Disconnect wallet
    disconnect() {
        this.walletAddress = null;
        this.signer = null;
        this.accountData = null;
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