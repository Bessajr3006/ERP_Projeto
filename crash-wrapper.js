const { spawn } = require('child_process');
const http = require('http');

let crashLog = '';

function startHttpServer(errorText) {
    console.error("Starting crash-log HTTP server on port 3000...");
    http.createServer((req, res) => {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end("=== BACKEND CRASH LOG ===\n\n" + errorText);
    }).listen(3000, '0.0.0.0');
}

function runCommand(command, args) {
    return new Promise((resolve) => {
        crashLog += `\n> Running: ${command} ${args.join(' ')}\n`;
        const proc = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        
        proc.stdout.on('data', (data) => {
            const str = data.toString();
            console.log(str);
            crashLog += str;
            if (crashLog.length > 500000) crashLog = crashLog.slice(-500000); // keep last 500kb
        });
        
        proc.stderr.on('data', (data) => {
            const str = data.toString();
            console.error(str);
            crashLog += str;
            if (crashLog.length > 500000) crashLog = crashLog.slice(-500000);
        });
        
        proc.on('close', (code) => {
            if (code === 0) {
                resolve(true);
            } else {
                crashLog += `\n\nProcess exited with code ${code}\n`;
                resolve(false);
            }
        });
        proc.on('error', (err) => {
            crashLog += `\n\nFailed to start process: ${err.message}\n`;
            resolve(false);
        });
    });
}

async function main() {
    const initOk = await runCommand('node', ['dist/scripts/initdb.js']);
    if (!initOk) {
        startHttpServer(crashLog);
        return;
    }
    
    crashLog += "\n=== InitDB completed, starting server ===\n\n";
    
    const serverOk = await runCommand('node', ['dist/server.js']);
    if (!serverOk) {
        startHttpServer(crashLog);
    }
}

main().catch(e => startHttpServer(e.stack));
