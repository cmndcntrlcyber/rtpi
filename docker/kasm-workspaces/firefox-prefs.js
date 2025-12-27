// Firefox preferences for security testing
// Optimized for web application penetration testing

// Disable automatic updates
user_pref("app.update.enabled", false);
user_pref("app.update.auto", false);

// Allow mixed content for testing
user_pref("security.mixed_content.block_active_content", false);
user_pref("security.mixed_content.block_display_content", false);

// Disable certificate errors for self-signed certs
user_pref("security.enterprise_roots.enabled", true);

// Enable developer tools by default
user_pref("devtools.chrome.enabled", true);
user_pref("devtools.debugger.remote-enabled", true);

// Disable privacy-preserving features for testing
user_pref("privacy.trackingprotection.enabled", false);
user_pref("browser.send_pings", true);

// Optimize download behavior
user_pref("browser.download.dir", "/home/kasm-user/downloads");
user_pref("browser.download.folderList", 2);
user_pref("browser.helperApps.neverAsk.saveToDisk", "application/octet-stream");

// Performance optimizations
user_pref("browser.sessionstore.interval", 600000); // 10 minutes
user_pref("browser.cache.disk.enable", true);
user_pref("browser.cache.memory.enable", true);
