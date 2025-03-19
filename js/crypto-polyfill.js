// crypto-polyfill.js
(function() {
    if (!window.crypto) {
      window.crypto = {};
    }
    
    if (!window.crypto.randomUUID) {
      window.crypto.randomUUID = function() {
        // RFC4122 compliant UUID implementation
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random() * 16 | 0, 
              v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };
      console.log("Added window.crypto.randomUUID polyfill");
    }
  })();