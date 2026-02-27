#!/usr/bin/env node

import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import boxen from 'boxen';
import path from 'path';
import { spawn } from 'child_process';
import ip from 'ip';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const banner = `
██╗    ██╗██╗███╗   ██╗    ███████╗████████╗██████╗ ███████╗ █████╗ ███╗   ███╗
██║    ██║██║████╗  ██║    ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██╔══██╗████╗ ████║
██║ █╗ ██║██║██╔██╗ ██║    ███████╗   ██║   ██████╔╝█████╗  ███████║██╔████╔██║
██║███╗██║██║██║╚██╗██║    ╚════██║   ██║   ██╔══██╗██╔══╝  ██╔══██║██║╚██╔╝██║
╚███╔███╔╝██║██║ ╚████║    ███████║   ██║   ██║  ██║███████╗██║  ██║██║ ╚═╝ ██║
 ╚══╝╚══╝ ╚═╝╚═╝  ╚═══╝    ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝
                                                                                  
                     🎧 AudioPilot Professional Audio Streaming 🎧
`;

class WinStreamAudio {
    constructor() {
        this.defaultPort = 8080;
        this.selectedPort = null;
        this.serverProcess = null;
    }

    async start() {
        console.clear();
        console.log(chalk.cyan(banner));
        console.log(boxen(
            chalk.white.bold('🎵 Stream Windows system audio to Android devices over WiFi\n') +
            chalk.gray('Professional audio controls • EQ • Pitch shifting • Effects'),
            { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'cyan' }
        ));

        try {
            await this.promptForSettings();
            await this.startServer();
        } catch (error) {
            console.error(chalk.red('❌ Error:'), error.message);
            process.exit(1);
        }
    }

    async promptForSettings() {
        const answers = await inquirer.prompt([
            {
                type: 'input', name: 'port', message: '🌐 Enter port number:', default: this.defaultPort.toString(),
                validate: (input) => {
                    const port = parseInt(input);
                    if (isNaN(port) || port < 1024 || port > 65535) return 'Please enter a valid port number (1024-65535)';
                    return true;
                }
            },
            { type: 'confirm', name: 'openBrowser', message: '🌐 Open browser automatically?', default: true }
        ]);
        this.selectedPort = parseInt(answers.port);
        this.openBrowser = answers.openBrowser;
    }

    async startServer() {
        const spinner = ora('🚀 Starting AudioPilot server...').start();
        try {
            const localIP = ip.address();
            const serverPath = path.join(__dirname, 'SfxMix.js'); // Assuming we wrap the Express/Server code securely
            
            process.env.PORT = this.selectedPort.toString();
            process.env.AUTO_OPEN = this.openBrowser ? 'true' : 'false';
            
            this.serverProcess = spawn('node', [serverPath], { stdio: 'pipe', env: process.env });
            
            this.serverProcess.stdout.on('data', data => {
                if (data.toString().includes('Server running')) {
                    spinner.succeed('✅ AudioPilot server started successfully!');
                    this.showConnectionInfo(localIP);
                }
            });
            
            this.serverProcess.stderr.on('data', data => { spinner.fail('❌ Server error'); console.error(chalk.red(data.toString())); });
            this.serverProcess.on('close', code => {
                if (code !== 0) spinner.fail(`❌ Server exited with code ${code}`);
                else console.log(chalk.yellow('\n👋 AudioPilot server stopped'));
            });
            
            process.on('SIGINT', () => {
                console.log(chalk.yellow('\n🛑 Shutting down AudioPilot server...'));
                if (this.serverProcess) this.serverProcess.kill('SIGTERM');
                process.exit(0);
            });
            
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) { spinner.fail('❌ Failed to start server'); throw error; }
    }

    showConnectionInfo(localIP) {
        const urls = {
            local: `http://localhost:${this.selectedPort}`,
            network: `http://${localIP}:${this.selectedPort}`,
            source: `http://${localIP}:${this.selectedPort}/simple-source.html`,
            audiopilot: `http://${localIP}:${this.selectedPort}/audiopilot.html`
        };

        console.log('\n' + boxen(
            chalk.white.bold('🎯 AudioPilot Connection URLs\n\n') +
            chalk.cyan('📱 Main Interface:\n') + chalk.white(`   ${urls.network}\n\n`) +
            chalk.cyan('🎤 PC Audio Source:\n') + chalk.white(`   ${urls.source}\n\n`) +
            chalk.cyan('🎧 AudioPilot Receiver (Android):\n') + chalk.white(`   ${urls.audiopilot}\n\n`) +
            chalk.yellow('💡 Quick Start:\n') +
            chalk.gray('   1. On PC: Open "PC Audio Source" and select "Stereo Mix"\n') +
            chalk.gray('   2. On Android: Open "AudioPilot Receiver" and connect\n') +
            chalk.gray('   3. Enjoy professional audio streaming with EQ & effects!'),
            { padding: 1, margin: 1, borderStyle: 'double', borderColor: 'green' }
        ));

        console.log(chalk.cyan('\n🛑 Press Ctrl+C to stop the server'));
    }
}

new WinStreamAudio().start().catch(console.error);
