const WALLET_STORAGE_KEY = generateStorageKey({
    // domain is automatically detected from current URL
    appName: 'CryptoWallet',
    feature: 'wallet'
  });

class WalletService {
    constructor() {
        // Reference to the kondor object injected by the extension
        this.kondor = window.kondor;
        this.walletAddress = this.getStoredWallet();
        
        // Check if axios is available
        if (!window.axios) {
            console.error('Axios is not loaded. Make sure to include the axios script in your HTML.');
        }
    }

    // Connect to wallet and get accounts
    async connect() {
        try {
            if (!this.kondor) {
                throw new Error('Kondor wallet extension not detected');
            }

            // Add a check if kondor is actually ready
            if (typeof this.kondor.getAccounts !== 'function') {
                throw new Error('Kondor wallet API not fully loaded');
            }

            // Add timeout to kondor operations
            const accounts = await this.promiseWithTimeout(
                this.kondor.getAccounts(),
                10000, // 10 second timeout
                'Wallet connection timed out'
            );
            
            if (!Array.isArray(accounts) || accounts.length === 0) {
                throw new Error('No accounts found in Kondor wallet');
            }

            this.walletAddress = accounts[0].address;
            this.storeWallet(this.walletAddress);
            
        } catch (error) {
            console.error('Error connecting to Kondor wallet:', error);
            
            // Provide more user-friendly error message
            let errorMessage = 'Failed to connect to wallet';
            
            if (error.message.includes('Connection lost')) {
                errorMessage = 'Connection to Kondor wallet was lost. Please check if the extension is installed and active.';
            } else if (error.message.includes('timeout')) {
                errorMessage = 'Connection to wallet timed out. Please try again.';
            } else if (error.message.includes('not detected')) {
                errorMessage = 'Kondor wallet extension not detected. Please install it to use this dApp.';
            }
            
            this.disconnect();
            
            // Create a more descriptive error
            const enhancedError = new Error(errorMessage);
            enhancedError.originalError = error;
            throw enhancedError;
        }
    }

    // Helper method to add timeout to promises
    async promiseWithTimeout(promise, timeoutMs, errorMessage) {
        let timeoutHandle;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutHandle = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
        });

        return Promise.race([
            promise,
            timeoutPromise
        ]).finally(() => {
            clearTimeout(timeoutHandle);
        });
    }

    // Get token balance
    async getBalance(contractAddress) {
        try {
            if (!this.walletAddress) {
                throw new Error('No wallet connected');
            }

            if (!window.axios) {
                throw new Error('Axios is not available');
            }

            const response = await window.axios.get(`https://api.koinos.io/v1/token/${contractAddress}/balance/${this.walletAddress}`, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            return response.data.value || '0';
        } catch (error) {
            console.error('Error getting balance:', error);
            
            // Handle Axios specific errors
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                throw new Error(`API error: ${error.response.status}`);
            } else if (error.request) {
                // The request was made but no response was received
                throw new Error('No response from API server');
            } else {
                // Something happened in setting up the request that triggered an Error
                throw error;
            }
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
}

function generateStorageKey(options = {}) {
    // Set default options
    const config = {
      domain: options.domain || window.location.hostname || 'localhost',
      appName: options.appName || 'app',
      feature: options.feature || 'default',
      version: options.version || '1'
    };
    
    // For localhost development, use a default domain
    if (config.domain === 'localhost' || config.domain === '127.0.0.1' || config.domain === '') {
      config.domain = 'local.app';
    }
    
    // Detect environment based on domain
    let environment = 'production';
    if (config.domain.includes('localhost') || 
        config.domain.includes('127.0.0.1') || 
        config.domain.includes('test') || 
        config.domain.includes('dev')) {
      environment = 'development';
    }
    
    // Extract domain parts and reverse them
    const domainParts = config.domain.split('.')
      .filter(part => part && part.trim() !== '')
      .reverse();
    
    // Build the key components array
    const keyParts = [
      ...domainParts,
      config.appName.toLowerCase().replace(/[^a-z0-9]/g, ''),
      config.feature.toLowerCase().replace(/[^a-z0-9]/g, ''),
      `v${config.version.toString().replace(/[^a-z0-9]/g, '')}`,
      environment
    ];
    
    // Join all parts with dots
    return keyParts.join('.');
  }

export default new WalletService();