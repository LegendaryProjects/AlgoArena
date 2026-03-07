import {exec} from "child_process"
import fs from "fs"
import path from "path"

app.use(express.json())

app.post('/run-code', (req, res) =>{
    const {code, language} = req.body
    const fileName = `solution_${Date.now()}.cpp`;
    const filePath = path.join(__dirname, 'temp', fileName);

    fs.writeFileSync(filePath, code);
    
    const dockerCmd = `docker run --rm -v ${path.join(__dirname, 'temp')}:/app algo-compiler sh -c "g++ /app/${fileName} -o /app/out && /app/out"`;

    exec(dockerCmd,  (error, stdout, stderr)=>{
        fs.unlinkSync(filePath);
        if(fs.existsSync(path.join(__dirname, "temp", 'out'))){
            fs.unlinkSync(path.join(__dirname, "temp", "out"));
        }

        if(error|| stderr){
            return res.json({ success: false, output: stderr || error.message});
        }
        res.json({ success: true, output: stdout});
    });
});
