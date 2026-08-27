const localtunnel = require('localtunnel');
const fs = require('fs');
const path = require('path');

(async () => {
    try {
        const tunnel = await localtunnel({ port: 8080 });
        const msg = `PUBLIC REWEAR URL: ${tunnel.url}\n`;
        console.log(msg);
        fs.writeFileSync(path.join(__dirname, 'tunnel_url.txt'), msg, 'utf8');

        tunnel.on('close', () => {
            console.log("Tunnel closed");
        });
    } catch (err) {
        fs.writeFileSync(path.join(__dirname, 'tunnel_url.txt'), `Error: ${err.message}\n`, 'utf8');
        console.error("Tunnel error:", err);
    }
})();
