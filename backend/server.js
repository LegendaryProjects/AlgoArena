import {exec} from "child_process"
import fs from "fs"
import path from "path"
import { spawn } from 'child_process';

app.use(express.json())




app.post('/run-code', async (req, res) => {
    const { code } = req.body;
    const fileName = `solution_${Date.now()}.cpp`;
    const tempDir = path.join(__dirname, 'temp');
    const filePath = path.join(tempDir, fileName);

    // 1. Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    // 2. Write code to the temporary file
    fs.writeFileSync(filePath, code);

    // 3. Command to compile and run inside Docker with safety limits
    // --rm: remove container after use | --network none: no internet
    // --memory: limit RAM | --cpus: limit CPU usage
    const dockerArgs = [
        'run', '--rm', 
        '--network', 'none',
        '--memory', '128m', 
        '--cpus', '0.5',
        '-v', `${tempDir}:/home/student`, 
        'algo-sandbox', 
        'sh', '-c', `g++ ${fileName} -o out && ./out`
    ];

    const child = spawn('docker', dockerArgs);

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => output += data.toString());
    child.stderr.on('data', (data) => errorOutput += data.toString());

    child.on('close', (code) => {
        // Cleanup: remove the temp file
        fs.unlinkSync(filePath);
        
        if (code === 0) {
            res.json({ success: true, output });
        } else {
            res.json({ success: false, output: errorOutput || "Execution Timed Out or Failed" });
        }
    });
});