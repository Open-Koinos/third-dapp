(function() {
    // Check if crypto.randomUUID is not available
    if (!crypto.randomUUID) {
      // Add a polyfill implementation
      crypto.randomUUID = function() {
        // Create a UUID v4 implementation
        return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
          (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
      };
      console.log("Added crypto.randomUUID polyfill");
    }
  })();