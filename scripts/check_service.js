const fs = require('fs');
const lines = fs.readFileSync('e:/Mazen/EgyDynamic/LMS_CO_Pilot/src/services/search_service.py', 'utf8').split('\n');
console.log('Total lines:', lines.length);
for (let i = 645; i < 710 && i < lines.length; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
