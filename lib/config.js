const path = require('path');
const os = require('os');
const fs = require('fs');

function getDefaultConfig() {
  let startPath = path.join(os.homedir(), 'AppData','Roaming');
  let storageFolder = undefined;
  // Try 'verdaccio' first
  try {
    storageFolder = path.join(startPath, 'verdaccio', 'storage');
    fs.statSync(storageFolder);
  } catch (err) {
    // Try 'sinopia'
    try {
      storageFolder = path.join(startPath, 'sinopia', 'storage');
      fs.statSync(storageFolder);
    } catch (e) {
      storageFolder = undefined;
    }
  }

  return { storageFolder };
}

module.exports = { getDefaultConfig };
