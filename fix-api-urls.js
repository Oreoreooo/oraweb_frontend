const fs = require('fs');
const path = require('path');

// Files to fix
const filesToFix = [
  'src/components/WriteStory.jsx',
  'src/components/Community.jsx'
];

filesToFix.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);
  
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Replace the problematic API_BASE_URL definitions
    content = content.replace(
      /const API_BASE_URL = import\.meta\.env\.VITE_API_BASE_URL \|\| 'http:\/\/localhost:5000';\s*/g,
      ''
    );
    
    // Also replace any remaining import.meta.env references
    content = content.replace(
      /import\.meta\.env\.VITE_API_BASE_URL/g,
      'process.env.REACT_APP_API_BASE_URL'
    );
    
    fs.writeFileSync(fullPath, content);
    console.log(`Fixed ${filePath}`);
  } else {
    console.log(`File not found: ${filePath}`);
  }
});

console.log('All files have been processed!');
