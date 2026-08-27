const fs = require('fs');
const lines = fs.readFileSync('public/css/style.css', 'utf8').split('\n');
lines.forEach((line, index) => {
    if (line.includes('show-left')) {
        console.log(`${index + 1}: ${line}`);
    }
});
