import { spawn, ChildProcess } from "child_process"
import { existsSync } from "fs";
import path, { dirname } from "path";
import { createInterface, ReadLine } from "readline";
import { fileURLToPath } from "url";

export interface PythonPacket {
    type: "pong" | "serverLog" | "error" | "metrics" | "containers" | "container.metrics"
    data: any
}

export class PythonBridge {
    private pythonProcess: ChildProcess | null = null;
    private rl: ReadLine | null = null;

    private onMessageCallback: (packet: PythonPacket) => void;

    constructor(onMessage: (packet: PythonPacket) => void) {
        this.onMessageCallback = onMessage;
    }

    public start() {
        const filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(filename)
        const backendRoot = path.resolve(__dirname, "../../backend");
        const scriptPath = path.resolve(backendRoot, "main.py");
        const pythonCandidates = process.platform === "win32"
            ? [
                path.join(backendRoot, ".venv", "Scripts", "python.exe"),
                path.join(backendRoot, ".venv", "Scripts", "python"),
                "python",
            ]
            : [
                path.join(backendRoot, ".venv", "bin", "python"),
                path.join(backendRoot, ".venv", "bin", "python3"),
                "python3",
                "python",
            ];
        const pythonExecutable = pythonCandidates.find(candidate => typeof candidate === "string" && (candidate.includes("/") || candidate.includes("\\")) ? existsSync(candidate) : true) ?? "python3";

        console.log(`[TS] Initializing a subprocess: ${pythonExecutable} ${scriptPath}`);
        this.pythonProcess = spawn(pythonExecutable, [scriptPath], {
            env: {
                ...process.env,
                PYTHONPATH: backendRoot,
            }
        });

        this.rl = createInterface({
            input: this.pythonProcess.stdout!,
            terminal: false
        });

        this.rl.on('line', (line) => {
            try {
                const packet: PythonPacket = JSON.parse(line);
                this.onMessageCallback(packet);
            }
            catch (err) {
                console.error(`[TS-ERROR] Error occured while tried to parse: ${err}`)
            }
        });

        this.pythonProcess.stderr?.on('data', (data) => {
            const parts = data.toString().split("|")
            this.onMessageCallback({"type": "serverLog", "data": {"level": parts[0], "msg": parts[1]}});
        })
        this.pythonProcess.on('close', (code) => {
            console.log(`[TS] Process of server is exited with ${code} code`)
            this.cleanup();
        })
    }

    public sendCommand(command: string, payload: object = {}) {
        if (!this.pythonProcess || !this.pythonProcess.stdin?.writable) {
            console.log("[TS-ERROR] Cannot write data into dead server process")
            return;
        }

        const packet = { command: command, payload: payload };

        this.pythonProcess.stdin.write(JSON.stringify(packet) + "\n");
    }

    public stop() {
        this.sendCommand("core_exit");
    }

    private cleanup() {
        if (this.rl) this.rl.close();
        this.pythonProcess = null;
    }
}