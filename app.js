// App state manager
class AppState {
  constructor() {
    this.tokenListData = [];
    this.currentWallet = '';
    this.tokenPriceData = {};
    this.STORAGE_TOKEN_BALANCES = 'koinosWallet_tokenBalances';
    this.STORAGE_CHECK_TIMESTAMPS = 'koinosWallet_checkTimestamps';
    this.STORAGE_PRICE_DATA = 'koinosWallet_priceData';
    this.STORAGE_PRICE_TIMESTAMP = 'koinosWallet_priceTimestamp';
    this.STORAGE_CUSTOM_TOKEN_LIST_URL = 'koinosWallet_customTokenListURL';
    this.CHECK_INTERVAL = 5000; // 5 seconds for tokens with balances
    this.INITIAL_CHECK_INTERVAL = 60000; // 60 seconds for new tokens
    this.PRICE_CHECK_INTERVAL = 300000; // 5 minutes for price data
    this.DEFAULT_TOKEN_LIST_URL = 'https://raw.githubusercontent.com/koindx/token-list/refs/heads/main/src/tokens/mainnet.json';
    this.TOKEN_LIST_URL = this.getCustomTokenListUrl() || this.DEFAULT_TOKEN_LIST_URL;
    this.PRICE_API_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=koinos&vs_currencies=usd';
  }

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

  // Add methods to get and save price data
  getPriceData() {
    try {
      const priceDataJson = localStorage.getItem(this.STORAGE_PRICE_DATA);
      const priceTimestampJson = localStorage.getItem(this.STORAGE_PRICE_TIMESTAMP);
      
      const priceData = priceDataJson ? JSON.parse(priceDataJson) : {};
      const timestamp = priceTimestampJson ? JSON.parse(priceTimestampJson) : 0;
      
      return { priceData, timestamp };
    } catch (error) {
      console.error('Error loading price data:', error);
      return { priceData: {}, timestamp: 0 };
    }
  }

  savePriceData(priceData) {
    try {
      localStorage.setItem(this.STORAGE_PRICE_DATA, JSON.stringify(priceData));
      localStorage.setItem(this.STORAGE_PRICE_TIMESTAMP, JSON.stringify(Date.now()));
      this.tokenPriceData = priceData;
    } catch (error) {
      console.error('Error saving price data:', error);
    }
  }

  shouldCheckPrices() {
    try {
      const { timestamp } = this.getPriceData();
      const timeElapsed = Date.now() - timestamp;
      return timeElapsed > this.PRICE_CHECK_INTERVAL;
    } catch (error) {
      console.error('Error checking price timestamp:', error);
      return true;
    }
  }

  // Custom token list URL methods
  getCustomTokenListUrl() {
    try {
      return localStorage.getItem(this.STORAGE_CUSTOM_TOKEN_LIST_URL) || null;
    } catch (error) {
      console.error('Error getting custom token list URL:', error);
      return null;
    }
  }

  saveCustomTokenListUrl(url) {
    try {
      if (url && url.trim()) {
        localStorage.setItem(this.STORAGE_CUSTOM_TOKEN_LIST_URL, url.trim());
        this.TOKEN_LIST_URL = url.trim();
      } else {
        localStorage.removeItem(this.STORAGE_CUSTOM_TOKEN_LIST_URL);
        this.TOKEN_LIST_URL = this.DEFAULT_TOKEN_LIST_URL;
      }
      
      // Clear token list data to force reload
      this.tokenListData = [];
      
      return true;
    } catch (error) {
      console.error('Error saving custom token list URL:', error);
      return false;
    }
  }

  resetToDefaultTokenListUrl() {
    try {
      localStorage.removeItem(this.STORAGE_CUSTOM_TOKEN_LIST_URL);
      this.TOKEN_LIST_URL = this.DEFAULT_TOKEN_LIST_URL;
      
      // Clear token list data to force reload
      this.tokenListData = [];
      
      return true;
    } catch (error) {
      console.error('Error resetting token list URL:', error);
      return false;
    }
  }
}

// App Controller
class AppController {
  constructor() {
    this.state = new AppState();
    this.deferredPrompt = null;
    this.isOnline = navigator.onLine;
    this.templates = {};
  }

  async init() {
    this.loadTemplates();
    this.renderApp();
    this.setupEventListeners();
    await this.fetchTokenList();
    
    // Initial wallet data
    const wallet = document.getElementById('walletInput').value.trim();
    const contract = document.getElementById('contractInput').value.trim();
    
    if (wallet && contract) {
      this.fetchBalance(wallet, contract);
    }

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
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', e => this.handleTabClick(e));
    });
    
    // Update button
    document.getElementById('updateButton').addEventListener('click', () => this.handleUpdate());
    
    // Settings form
    document.getElementById('settingsForm').addEventListener('submit', (e) => this.handleSettingsSave(e));
    document.getElementById('resetSettingsButton').addEventListener('click', () => this.handleSettingsReset());
    
    // Populate settings form
    this.populateSettingsForm();
    
    // Online/offline events
    window.addEventListener('online', () => this.handleOnlineStatus(true));
    window.addEventListener('offline', () => this.handleOnlineStatus(false));
  }

  handleSettingsSave(event) {
    event.preventDefault();
    const tokenListUrl = document.getElementById('tokenListUrl').value.trim();
    
    const success = this.state.saveCustomTokenListUrl(tokenListUrl);
    const messageElement = document.getElementById('settingsMessage');
    
    if (success) {
      messageElement.textContent = 'Settings saved successfully. Token list will be updated on next refresh.';
      messageElement.className = 'settings-message success';
      
      // Hide message after 3 seconds
      setTimeout(() => {
        messageElement.className = 'settings-message';
      }, 3000);
    } else {
      messageElement.textContent = 'Error saving settings. Please try again.';
      messageElement.className = 'settings-message error';
    }
  }

  handleSettingsReset() {
    const success = this.state.resetToDefaultTokenListUrl();
    const messageElement = document.getElementById('settingsMessage');
    
    if (success) {
      // Update the input field
      document.getElementById('tokenListUrl').value = '';
      
      messageElement.textContent = 'Settings reset to default. Token list will be updated on next refresh.';
      messageElement.className = 'settings-message success';
      
      // Hide message after 3 seconds
      setTimeout(() => {
        messageElement.className = 'settings-message';
      }, 3000);
    } else {
      messageElement.textContent = 'Error resetting settings. Please try again.';
      messageElement.className = 'settings-message error';
    }
  }

  populateSettingsForm() {
    const customUrl = this.state.getCustomTokenListUrl();
    if (customUrl) {
      document.getElementById('tokenListUrl').value = customUrl;
    }
  }

  handleTabClick(event) {
    const tabId = event.target.getAttribute('data-tab');
    
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(tabId + 'Tab').classList.add('active');
    
    if (tabId === 'tokens' && this.state.currentWallet) {
      this.fetchTokenBalances(this.state.currentWallet);
    }
  }

  handleUpdate() {
    const wallet = document.getElementById('walletInput').value.trim();
    const contract = document.getElementById('contractInput').value.trim();
    
    if (!wallet || !contract) {
      alert("Please enter both fields");
      return;
    }
    
    this.fetchBalance(wallet, contract);
    
    if (document.querySelector('.tab[data-tab="tokens"]').classList.contains('active')) {
      this.fetchTokenBalances(wallet);
    }
  }

  handleOnlineStatus(isOnline) {
    this.isOnline = isOnline;
    const offlineAlert = document.getElementById('offline-alert');
    offlineAlert.style.display = isOnline ? 'none' : 'block';
  }

  async fetchPriceData() {
    try {
      if (!this.isOnline) {
        console.log('Offline: Using cached price data');
        const { priceData } = this.state.getPriceData();
        this.state.tokenPriceData = priceData;
        return priceData;
      }
      
      if (!this.state.shouldCheckPrices()) {
        console.log('Using cached price data');
        const { priceData } = this.state.getPriceData();
        this.state.tokenPriceData = priceData;
        return priceData;
      }
      
      const response = await axios.get(this.state.PRICE_API_URL);
      
      if (response.data && typeof response.data === 'object') {
        this.state.savePriceData(response.data);
        return response.data;
      } else {
        console.error('Invalid price data:', response.data);
        const { priceData } = this.state.getPriceData();
        this.state.tokenPriceData = priceData;
        return priceData;
      }
    } catch (error) {
      console.error('Error fetching price data:', error);
      const { priceData } = this.state.getPriceData();
      this.state.tokenPriceData = priceData;
      return priceData;
    }
  }

  calculateUsdValue(balance, symbol) {
    try {
      // For now, we only have KOIN price data
      if (symbol === 'KOIN' && 
          this.state.tokenPriceData && 
          this.state.tokenPriceData.koinos && 
          this.state.tokenPriceData.koinos.usd) {
        
        const price = this.state.tokenPriceData.koinos.usd;
        const balanceNum = parseFloat(balance);
        
        if (!isNaN(balanceNum) && price) {
          const usdValue = balanceNum * price;
          return {
            total: usdValue.toFixed(2),
            price: price.toFixed(4)
          };
        }
      }
    } catch (error) {
      console.error('Error calculating USD value:', error);
    }
    
    return { total: null, price: null };
  }

  async fetchTokenList() {
    try {
      if (!this.isOnline) {
        console.log('Offline: Using cached token list');
        return [];
      }
      
      const response = await axios.get(this.state.TOKEN_LIST_URL);
      
      if (response.data && typeof response.data === 'object') {
        if (Array.isArray(response.data)) {
          this.state.tokenListData = response.data;
        } else if (Array.isArray(response.data.tokens)) {
          this.state.tokenListData = response.data.tokens;
        } else {
          console.warn('Unexpected token list format:', response.data);
          this.state.tokenListData = Object.values(response.data).filter(item => 
            typeof item === 'object' && item.address && item.symbol
          );
        }
      } else {
        console.error('Invalid token list data:', response.data);
        this.state.tokenListData = [];
      }
      
      return this.state.tokenListData;
    } catch (error) {
      console.error('Error fetching token list:', error);
      this.state.tokenListData = [];
      return [];
    }
  }

  async fetchBalance(wallet, contract) {
    const balanceElement = document.getElementById('balance');
    const balanceLabel = document.getElementById('balanceLabel');
    const balanceUsdValue = document.getElementById('balanceUsdValue');
    
    balanceElement.textContent = "Loading...";
    balanceUsdValue.textContent = "";
    this.state.currentWallet = wallet;
    
    const isNickname = wallet.startsWith('@');
    balanceLabel.textContent = isNickname ? 
      `Balance for ${wallet}` : 
      `Balance for address`;
    
    const cachedBalance = this.state.getCachedBalance(wallet, contract);
    if (cachedBalance && !this.state.shouldCheckToken(wallet, contract)) {
      console.log('Using cached balance for main token');
      
      this.state.ensureTokenListIsArray();
      const tokenInfo = this.state.tokenListData.find(token => token && token.address === contract);
      const symbol = tokenInfo ? tokenInfo.symbol : (contract === '15DJN4a8SgrbGhhGksSBASiSYjGnMU8dGL' ? 'KOIN' : 'tokens');
      
      balanceElement.textContent = cachedBalance + ' ' + symbol;
      
      // Add USD value for KOIN
      if (symbol === 'KOIN') {
        await this.fetchPriceData();
        const valueData = this.calculateUsdValue(cachedBalance, symbol);
        if (valueData.total) {
          balanceUsdValue.textContent = `${valueData.total} USD`;
        }
      }
      return;
    }
    
    try {
      if (!this.isOnline) {
        balanceElement.textContent = cachedBalance ? (cachedBalance + ' (cached)') : 'Offline';
        return;
      }
      
      const response = await axios.get(`https://api.koinos.io/v1/token/${contract}/balance/${wallet}`);
      
      this.state.ensureTokenListIsArray();
      const tokenInfo = this.state.tokenListData.find(token => token && token.address === contract);
      const symbol = tokenInfo ? tokenInfo.symbol : (contract === '15DJN4a8SgrbGhhGksSBASiSYjGnMU8dGL' ? 'KOIN' : 'tokens');
      
      this.state.saveTokenBalance(wallet, contract, response.data.value);
      
      balanceElement.textContent = response.data.value + ' ' + symbol;
      
      // Add USD value for KOIN
      if (symbol === 'KOIN') {
        await this.fetchPriceData();
        const valueData = this.calculateUsdValue(response.data.value, symbol);
        if (valueData.total) {
          balanceUsdValue.textContent = `${valueData.total} USD`;
        }
      }
    } catch (error) {
      balanceElement.textContent = 'Error fetching balance';
      console.error('Error:', error);
    }
  }

  async fetchTokenBalances(wallet) {
    const tokenListElement = document.getElementById('tokenList');
    
    tokenListElement.innerHTML = '<div class="loading">Starting token balance check...</div>';
    
    try {
      if (!Array.isArray(this.state.tokenListData) || this.state.tokenListData.length === 0) {
        tokenListElement.innerHTML = '<div class="loading">Loading token list...</div>';
        await this.fetchTokenList();
      }
      
      // Fetch price data
      await this.fetchPriceData();
      
      this.state.ensureTokenListIsArray();
      
      const tokensWithBalance = [];
      
      // Initial status display
      tokenListElement.innerHTML = this.render('token-status-template', {
        statusMessage: 'Token check: 0/' + this.state.tokenListData.length,
        foundCount: '0',
        currentStatus: 'Checking: starting...',
        additionalInfo: ''
      });
      
      const tokenResultsElement = document.getElementById('token-results');
      
      // Display cached non-zero balances
      let displayedCount = 0;
      const { balances } = this.state.loadCachedData();
      
      // Display tokens with non-zero balances first
      for (let i = 0; i < this.state.tokenListData.length; i++) {
        const token = this.state.tokenListData[i];
        if (!token) continue;
        
        const cachedBalance = this.state.getCachedBalance(wallet, token.address);
        
        if (cachedBalance && cachedBalance !== '0') {
          displayedCount++;
          
          const valueData = this.calculateUsdValue(cachedBalance, token.symbol);
          
          tokensWithBalance.push({
            ...token,
            balance: cachedBalance,
            usdValue: valueData.total,
            unitPrice: valueData.price
          });
          
          // Render token item
          tokenResultsElement.innerHTML += this.render('token-item-template', {
            address: token.address,
            logoURI: token.logoURI || 'https://koindx.com/logo.svg',
            symbol: token.symbol,
            name: token.name,
            balance: cachedBalance,
            usdValue: valueData.total ? `${valueData.total}` : '',
            unitPrice: valueData.price ? `${valueData.price}/token` : '',
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
        const tokensToCheck = this.state.tokenListData.filter(token => 
          token && this.state.shouldCheckToken(wallet, token.address)
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
            const response = await axios.get(`https://api.koinos.io/v1/token/${token.address}/balance/${wallet}`)
              .catch(error => {
                console.log(`Skipping token ${token.symbol}: ${error.message}`);
                return { data: { value: '0' } };
              });
              
            const balance = response.data.value;
            this.state.saveTokenBalance(wallet, token.address, balance);
            
            if (balance && balance !== '0') {
              const valueData = this.calculateUsdValue(balance, token.symbol);
              
              const existingTokenIndex = tokensWithBalance.findIndex(t => t.address === token.address);
              
              if (existingTokenIndex >= 0) {
                tokensWithBalance[existingTokenIndex].balance = balance;
                tokensWithBalance[existingTokenIndex].usdValue = valueData.total;
                tokensWithBalance[existingTokenIndex].unitPrice = valueData.price;
                
                const tokenElement = tokenResultsElement.querySelector(`[data-address="${token.address}"]`);
                if (tokenElement) {
                  tokenElement.querySelector('.token-balance').textContent = balance;
                  const usdElement = tokenElement.querySelector('.token-usd-value');
                  if (usdElement) {
                    usdElement.textContent = valueData.total ? `${valueData.total}` : '';
                  }
                  const priceElement = tokenElement.querySelector('.token-unit-price');
                  if (priceElement) {
                    priceElement.textContent = valueData.price ? `${valueData.price}/token` : '';
                  }
                  tokenElement.style.animation = 'fadeIn 0.5s';
                }
              } else {
                tokensWithBalance.push({
                  ...token,
                  balance: balance,
                  usdValue: valueData.total,
                  unitPrice: valueData.price
                });
                
                const tokenHtml = this.render('token-item-template', {
                  address: token.address,
                  logoURI: token.logoURI || 'https://koindx.com/logo.svg',
                  symbol: token.symbol,
                  name: token.name,
                  balance: balance,
                  usdValue: valueData.total ? `${valueData.total}` : '',
                  unitPrice: valueData.price ? `${valueData.price}/token` : '',
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
      
      // Sort tokens by USD value
      tokensWithBalance.sort((a, b) => {
        const aValue = a.usdValue ? parseFloat(a.usdValue) : 0;
        const bValue = b.usdValue ? parseFloat(b.usdValue) : 0;
        return bValue - aValue; // Sort from highest to lowest
      });
      
      // Clear and re-render token list in sorted order
      tokenResultsElement.innerHTML = '';
      tokensWithBalance.forEach(token => {
        tokenResultsElement.innerHTML += this.render('token-item-template', {
          address: token.address,
          logoURI: token.logoURI || 'https://koindx.com/logo.svg',
          symbol: token.symbol,
          name: token.name,
          balance: token.balance,
          usdValue: token.usdValue ? `$${token.usdValue}` : '',
          animation: ''
        });
      });
      
      // Final display update
      const additionalInfo = this.isOnline ? 
        `<div style="font-size: 0.7rem; margin-top: 0.3rem; color: #666;">
          Refresh intervals: ${this.state.CHECK_INTERVAL/1000}s (known tokens), ${this.state.INITIAL_CHECK_INTERVAL/1000}s (new tokens)
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
          });
      });
    }
  }

  setupPWA() {
    const installBanner = document.getElementById('install-banner');
    const installButton = document.getElementById('install-button');
    
    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Store the event so it can be triggered later
      this.deferredPrompt = e;
      // Show the install banner
      installBanner.style.display = 'block';
    });
    
    // Installation button click handler
    installButton.addEventListener('click', () => {
      if (!this.deferredPrompt) return;
      
      // Show the install prompt
      this.deferredPrompt.prompt();
      
      // Wait for the user to respond to the prompt
      this.deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
          installBanner.style.display = 'none';
        } 
        this.deferredPrompt = null;
      });
    });
    
    // Hide the banner if app is already installed
    window.addEventListener('appinstalled', () => {
      installBanner.style.display = 'none';
      this.deferredPrompt = null;
    });
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new AppController().init();
});