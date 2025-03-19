// This script checks for and initializes the Kondor wallet connection

class KondorInitializer {
    constructor() {
        this.isKondorReady = false;
        this.checkInterval = null;
        this.checkAttempts = 0;
        this.maxAttempts = 10;
        this.listeners = [];
    }

    initialize() {
        // Check if Kondor is already available
        if (typeof window.kondor !== 'undefined' && typeof window.kondor.getAccounts === 'function') {
            this.isKondorReady = true;
            this.notifyListeners(true);
            return Promise.resolve(true);
        }

        // Start checking for Kondor
        return new Promise((resolve) => {
            this.checkInterval = setInterval(() => {
                this.checkAttempts++;
                
                if (typeof window.kondor !== 'undefined' && typeof window.kondor.getAccounts === 'function') {
                    this.isKondorReady = true;
                    clearInterval(this.checkInterval);
                    this.notifyListeners(true);
                    resolve(true);
                } else if (this.checkAttempts >= this.maxAttempts) {
                    // Give up after max attempts
                    clearInterval(this.checkInterval);
                    console.warn('Kondor wallet not detected after multiple attempts');
                    this.notifyListeners(false);
                    resolve(false);
                }
            }, 500); // Check every 500ms
        });
    }

    onStatusChange(callback) {
        if (typeof callback === 'function') {
            this.listeners.push(callback);
            
            // Immediately call with current status if already determined
            if (this.isKondorReady === true || this.checkAttempts >= this.maxAttempts) {
                callback(this.isKondorReady);
            }
        }
    }

    notifyListeners(status) {
        this.listeners.forEach(callback => {
            try {
                callback(status);
            } catch (error) {
                console.error('Error in Kondor status listener:', error);
            }
        });
    }
}

// Create and export a singleton instance
const kondorInitializer = new KondorInitializer();

// Auto-initialize on script load
kondorInitializer.initialize();

export default kondorInitializer;
