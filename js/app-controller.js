// app-controller.js
import walletService from './wallet-service.js';

class AppController {
    constructor() {
        // App state
        this.deferredPrompt = null;
        this.isOnline = navigator.onLine;
        this.templates = {};
        this.elements = {};
        this.isLoading = false;
        this.tokenListData = [];
        this.currentWallet = '';
        
        // Constants
        this.STORAGE_TOKEN_BALANCES = 'koinosWallet_tokenBalances';
        this.STORAGE_CHECK_TIMESTAMPS = 'koinosWallet_checkTimestamps';
        this.CHECK_INTERVAL = 5000; // 5 seconds for tokens with balances
        this.INITIAL_CHECK_INTERVAL = 60000; // 60 seconds for new tokens
        this.TOKEN_LIST_URL = 'https://raw.githubusercontent.com/koindx/token-list/refs/heads/main/src/tokens/mainnet.json';
    }

    async initialize() {
        // Load templates
        this.loadTemplates();
        
        // Render main app structure
        this.renderApp();
        
        // Cache DOM elements
        this.cacheElements();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Check if the Kondor wallet is available
        if (typeof window.kondor === 'undefined') {
            this.showMessage('Kondor wallet extension not detected. Please install it to use this dApp.', 'warning');
            this.elements.connectButton.disabled = true;
        }
        
        // Fetch token list
        await this.fetchTokenList();
        
        // Update UI state
        this.updateUIState();
        
        // Register service worker
        this.registerServiceWorker();
        
        // Setup PWA features
        this.setupPWA();
    }

    loadTemplates() {
        document.querySelectorAll('template').forEach(template => {
            this.templates[template.id] = template.innerHTML;
        });
    }

    cacheElements() {
        // Wallet connection elements
        this.elements.connectButton = document.getElementById('connect-wallet');
        this.elements.disconnectButton = document.getElementById('disconnect-wallet');
        this.elements.walletStatus = document.getElementById('wallet-status');
        this.elements.walletAddress = document.getElementById('wallet-address');
        this.elements.manaDisplay = document.getElementById('mana-display');
        
        // Token interaction elements
        this.elements.contractInput = document.getElementById('contractInput');
        this.elements.balanceButton = document.getElementById('updateButton');
        this.elements.balanceDisplay = document.getElementById('balance');
        this.elements.balanceLabel = document.getElementById('balanceLabel');
        
        // Token list element
        this.elements.tokenList = document.getElementById('tokenList');
        
        // Alert elements
        this.elements.offlineAlert = document.getElementById('offline-alert');
        this.elements.errorAlert = document.getElementById('error-alert');
        
        // Loader element
        this.elements.loader = document.getElementById('loader');
        
        // Install banner
        this.elements.installBanner = document.getElementById('install-banner');
        this.elements.installButton = document.getElementById('install-button');
    }

    render(templateId, data) {
        let html = this.templates[templateId];
        if (!html) return '';

        // Replace all placeholders {{key}} with their values
        Object.keys(data).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            html = html.replace(regex, data[key] || '');
        });

        return html;
    }

    renderApp() {
        const container = document.getElementById('app-container');
        container.innerHTML = this.render('main-template', {});
    }

    setupEventListeners() {
        // Wallet connection events
        this.elements.connectButton.addEventListener('click', () => this.connectWallet());
        this.elements.disconnectButton.addEventListener('click', () => this.disconnectWallet());
        
        // Token balance update
        this.elements.balanceButton.addEventListener('click', () => this.checkBalance());
        
        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', e => this.handleTabClick(e));
        });
        
        // Online/offline events
        window.addEventListener('online', () => this.handleOnlineStatus(true));
        window.addEventListener('offline', () => this.handleOnlineStatus(false));
        
        // Wallet error events
        document.addEventListener('wallet-error', (event) => {
            this.showError(event.detail.message);
        });
    }

    handleTabClick(event) {
        const tabId = event.target.getAttribute('data-tab');
        
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        event.target.classList.add('active');
        document.getElementById(tabId + 'Tab').classList.add('active');
        
        if (tabId === 'tokens' && walletService.isConnected()) {
            this.fetchTokenBalances(walletService.walletAddress);
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
            this.currentWallet = walletService.walletAddress;
            this.elements.walletAddress.textContent = walletService.formatAddress();
            this.elements.balanceLabel.textContent = `Balance for ${walletService.formatAddress()}`;
            
            // Update mana display
            this.updateManaDisplay();
            
            // Check balance
            this.checkBalance();
        } else {
            this.currentWallet = '';
            this.elements.walletAddress.textContent = 'Connect your wallet';
            this.elements.manaDisplay.textContent = '';
            this.elements.balanceDisplay.textContent = '';
            this.elements.balanceLabel.textContent = 'Balance';
        }
    }

    async updateManaDisplay() {
        if (!walletService.isConnected()) return;
        
        try {
            const mana = await walletService.getMana();
            this.elements.manaDisplay.textContent = `Mana: ${this.formatNumber(mana)}`;
        } catch (error) {
            console.error('Error updating mana display:', error);
            this.elements.manaDisplay.textContent = 'Mana: Error';
            this.showError('Failed to update mana display');
        }
    }

    async connectWallet() {
        this.showLoader('Connecting to wallet...');
        
        try {
            await walletService.connect();
            this.updateUIState();
            this.showMessage('Wallet connected successfully!', 'success');
        } catch (error) {
            console.error('Failed to connect wallet:', error);
            this.showMessage(`Failed to connect wallet: ${error.message}`, 'error');
            this.showError('Failed to connect wallet');
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
        
        if (!walletService.isConnected()) {
            this.showMessage('Please connect your wallet first', 'warning');
            return;
        }
        
        this.showLoader('Checking balance...');
        
        try {
            const balance = await walletService.getBalance(contractAddress);
            
            // Find token info
            const tokenInfo = this.findTokenInfo(contractAddress);
            const symbol = tokenInfo ? tokenInfo.symbol : (contractAddress === '15DJN4a8SgrbGhhGksSBASiSYjGnMU8dGL' ? 'KOIN' : 'tokens');
            
            this.elements.balanceDisplay.textContent = `${balance} ${symbol}`;
        } catch (error) {
            console.error('Error checking balance:', error);
            this.showMessage(`Error checking balance: ${error.message}`, 'error');
            this.elements.balanceDisplay.textContent = 'Balance: Error';
            this.showError('Failed to check balance');
        } finally {
            this.hideLoader();
        }
    }

    findTokenInfo(contractAddress) {
        if (!Array.isArray(this.tokenListData)) return null;
        return this.tokenListData.find(token => token && token.address === contractAddress);
    }

    async fetchTokenList() {
        try {
            if (!this.isOnline) {
                console.log('Offline: Using cached token list');
                return [];
            }
            
            console.log('Fetching token list...');
            const response = await fetch(this.TOKEN_LIST_URL);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch token list: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data && typeof data === 'object') {
                if (Array.isArray(data)) {
                    this.tokenListData = data;
                } else if (Array.isArray(data.tokens)) {
                    this.tokenListData = data.tokens;
                } else {
                    console.warn('Unexpected token list format:', data);
                    this.tokenListData = Object.values(data).filter(item => 
                        typeof item === 'object' && item.address && item.symbol
                    );
                }
            } else {
                console.error('Invalid token list data:', data);
                this.tokenListData = [];
            }
            
            console.log(`Fetched ${this.tokenListData.length} tokens`);
            return this.tokenListData;
        } catch (error) {
            console.error('Error fetching token list:', error);
            this.showError('Failed to fetch token list');
            this.tokenListData = [];
            return [];
        }
    }

    async fetchTokenBalances(wallet) {
        if (!wallet) {
            this.showMessage('No wallet connected', 'warning');
            return;
        }
        
        const tokenListElement = this.elements.tokenList;
        
        tokenListElement.innerHTML = '<div class="loading">Starting token balance check...</div>';
        
        try {
            if (!Array.isArray(this.tokenListData) || this.tokenListData.length === 0) {
                tokenListElement.innerHTML = '<div class="loading">Loading token list...</div>';
                await this.fetchTokenList();
            }
            
            this.ensureTokenListIsArray();
            
            const tokensWithBalance = [];
            
            // Initial status display
            tokenListElement.innerHTML = this.render('token-status-template', {
                statusMessage: 'Token check: 0/' + this.tokenListData.length,
                foundCount: '0',
                currentStatus: 'Checking: starting...',
                additionalInfo: ''
            });
            
            const tokenResultsElement = document.getElementById('token-results');
            
            // Display cached non-zero balances
            let displayedCount = 0;
            const { balances } = this.loadCachedData();
            
            // Display tokens with non-zero balances first
            for (let i = 0; i < this.tokenListData.length; i++) {
                const token = this.tokenListData[i];
                if (!token) continue;
                
                const cachedBalance = this.getCachedBalance(wallet, token.address);
                
                if (cachedBalance && cachedBalance !== '0') {
                    displayedCount++;
                    
                    tokensWithBalance.push({
                        ...token,
                        balance: cachedBalance
                    });
                    
                    // Render token item
                    tokenResultsElement.innerHTML += this.render('token-item-template', {
                        address: token.address,
                        logoURI: token.logoURI || 'https://koindx.com/logo.svg',
                        symbol: token.symbol,
                        name: token.name,
                        balance: cachedBalance,
                        animation: ''
                    });
                }
            }
            
            // Update status
            tokenListElement.firstElementChild.innerHTML = `
                <div>Loaded from cache: ${displayedCount} tokens</div>
                <div>Checking for updates...</div>
            `;
            
            // Check tokens that need updating
            if (this.isOnline) {
                const tokensToCheck = this.tokenListData.filter(token => 
                    token && this.shouldCheckToken(wallet, token.address)
                );
                
                for (let i = 0; i < tokensToCheck.length; i++) {
                    const token = tokensToCheck[i];
                    
                    // Update status
                    tokenListElement.firstElementChild.innerHTML = `
                        <div>Token check: ${i+1}/${tokensToCheck.length}</div>
                        <div>Found: ${tokensWithBalance.length} tokens</div>
                        <div id="current-token">Checking: ${token.symbol} (${token.name})</div>
                    `;
                    
                    try {
                        const balance = await walletService.getBalance(token.address);
                        this.saveTokenBalance(wallet, token.address, balance);
                        
                        if (balance && balance !== '0') {
                            const existingTokenIndex = tokensWithBalance.findIndex(t => t.address === token.address);
                            
                            if (existingTokenIndex >= 0) {
                                tokensWithBalance[existingTokenIndex].balance = balance;
                                
                                const tokenElement = tokenResultsElement.querySelector(`[data-address="${token.address}"] .token-balance`);
                                if (tokenElement) {
                                    tokenElement.textContent = balance;
                                    tokenElement.parentElement.style.animation = 'fadeIn 0.5s';
                                }
                            } else {
                                tokensWithBalance.push({
                                    ...token,
                                    balance: balance
                                });
                                
                                const tokenHtml = this.render('token-item-template', {
                                    address: token.address,
                                    logoURI: token.logoURI || 'https://koindx.com/logo.svg',
                                    symbol: token.symbol,
                                    name: token.name,
                                    balance: balance,
                                    animation: 'animation: fadeIn 0.5s;'
                                });
                                
                                tokenResultsElement.innerHTML = tokenHtml + tokenResultsElement.innerHTML;
                            }
                        }
                    } catch (error) {
                        console.error(`Error checking balance for ${token.symbol}:`, error);
                    }
                    
                    // Small delay to avoid API rate limits
                    if (i < tokensToCheck.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
            }
            
            // Final display update
            const additionalInfo = this.isOnline ? 
                `<div style="font-size: 0.7rem; margin-top: 0.3rem; color: #666;">
                    Refresh intervals: ${this.CHECK_INTERVAL/1000}s (known tokens), ${this.INITIAL_CHECK_INTERVAL/1000}s (new tokens)
                </div>` : 
                `<div style="font-size: 0.7rem; margin-top: 0.3rem; color: #666;">
                    Using cached data (offline mode)
                </div>`;
            
            if (tokensWithBalance.length === 0) {
                tokenListElement.innerHTML = '<div>No tokens found for this wallet</div>';
            } else {
                tokenListElement.firstElementChild.innerHTML = `
                    <div>Complete!</div>
                    <div>Found: ${tokensWithBalance.length} tokens</div>
                    <div>Last updated: ${new Date().toLocaleTimeString()}</div>
                    ${additionalInfo}
                `;
            }
        } catch (error) {
            console.error('Error fetching token balances:', error);
            tokenListElement.innerHTML = '<div>Error loading token balances</div>';
            this.showError('Failed to fetch token balances');
        }
    }

    // Cache management functions
    loadCachedData() {
        try {
            const balancesJson = localStorage.getItem(this.STORAGE_TOKEN_BALANCES);
            const timestampsJson = localStorage.getItem(this.STORAGE_CHECK_TIMESTAMPS);
            
            return { 
                balances: balancesJson ? JSON.parse(balancesJson) : {},
                timestamps: timestampsJson ? JSON.parse(timestampsJson) : {}
            };
        } catch (error) {
            console.error('Error loading cached data:', error);
            return { balances: {}, timestamps: {} };
        }
    }

    saveTokenBalance(wallet, tokenAddress, balance) {
        try {
            const { balances, timestamps } = this.loadCachedData();
            
            const key = `${wallet}_${tokenAddress}`;
            balances[key] = balance;
            timestamps[key] = Date.now();
            
            localStorage.setItem(this.STORAGE_TOKEN_BALANCES, JSON.stringify(balances));
            localStorage.setItem(this.STORAGE_CHECK_TIMESTAMPS, JSON.stringify(timestamps));
        } catch (error) {
            console.error('Error saving token balance:', error);
        }
    }

    shouldCheckToken(wallet, tokenAddress) {
        try {
            const { balances, timestamps } = this.loadCachedData();
            const key = `${wallet}_${tokenAddress}`;
            
            const lastChecked = timestamps[key] || 0;
            const timeElapsed = Date.now() - lastChecked;
            
            const hasStoredNonZeroBalance = balances[key] && balances[key] !== '0';
            const interval = hasStoredNonZeroBalance ? this.CHECK_INTERVAL : this.INITIAL_CHECK_INTERVAL;
            
            return timeElapsed > interval;
        } catch (error) {
            console.error('Error checking token timestamp:', error);
            return true;
        }
    }

    getCachedBalance(wallet, tokenAddress) {
        try {
            const { balances } = this.loadCachedData();
            return balances[`${wallet}_${tokenAddress}`] || null;
        } catch (error) {
            console.error('Error getting cached balance:', error);
            return null;
        }
    }

    ensureTokenListIsArray() {
        if (!Array.isArray(this.tokenListData)) {
            console.error('Token list is not an array:', this.tokenListData);
            this.tokenListData = Array.isArray(this.tokenListData.tokens) 
                ? this.tokenListData.tokens 
                : [];
        }
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js')
                    .then(registration => {
                        console.log('ServiceWorker registration successful with scope: ', registration.scope);
                    })
                    .catch(error => {
                        console.error('ServiceWorker registration failed: ', error);
                        this.showError('Failed to register service worker');
                    });
            });
        }
    }

    setupPWA() {
        // Listen for the beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Store the event so it can be triggered later
            this.deferredPrompt = e;
            // Show the install banner
            this.elements.installBanner.style.display = 'block';
        });
        
        // Installation button click handler
        this.elements.installButton.addEventListener('click', () => {
            if (!this.deferredPrompt) return;
            
            // Show the install prompt
            this.deferredPrompt.prompt();
            
            // Wait for the user to respond to the prompt
            this.deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the install prompt');
                    this.elements.installBanner.style.display = 'none';
                } 
                this.deferredPrompt = null;
            });
        });
        
        // Hide the banner if app is already installed
        window.addEventListener('appinstalled', () => {
            this.elements.installBanner.style.display = 'none';
            this.deferredPrompt = null;
        });
    }

    handleOnlineStatus(isOnline) {
        this.isOnline = isOnline;
        this.elements.offlineAlert.style.display = isOnline ? 'none' : 'block';
        
        if (isOnline) {
            this.showMessage('You are back online', 'success');
            
            // Refresh data if wallet is connected
            if (walletService.isConnected()) {
                this.updateManaDisplay();
                this.checkBalance();
                
                // Refresh token list if on tokens tab
                if (document.querySelector('.tab[data-tab="tokens"]').classList.contains('active')) {
                    this.fetchTokenBalances(walletService.walletAddress);
                }
            }
        } else {
            this.showMessage('You are offline. Some features may be limited.', 'warning');
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

    showError(message) {
        console.error(message);
        this.elements.errorAlert.textContent = message;
        this.elements.errorAlert.style.display = 'block';
        
        // Hide after 5 seconds
        setTimeout(() => {
            this.elements.errorAlert.style.display = 'none';
        }, 5000);
    }

    formatNumber(num) {
        // Format large numbers with commas
        return new Intl.NumberFormat().format(num);
    }
}

export default new AppController();