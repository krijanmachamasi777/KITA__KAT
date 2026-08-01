const fs = require('fs');
const path = require('path');

const USER_FOLDERS = [
  'applicableissues',
  'portfolioitems',
  'portfoliosummaries',
  'shares',
    'userprofiles',
  'waccs',
];

function createUserFolders(userId) {
  const baseDir = path.join(__dirname, '..', 'users', String(userId));

  USER_FOLDERS.forEach((folder) => {
    const folderPath = path.join(baseDir, folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
      console.log(`Created: ${folderPath}`);
    }
  });
}

module.exports = { createUserFolders };