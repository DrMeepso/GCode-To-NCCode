import { GCodeToNC } from "./lib";
import fs from "fs";

// get CLI arguments
let args = process.argv.slice(2);
if (args.length > 0 && args[0] && args[1]) {
    if (fs.existsSync(args[0])) {
        let data = fs.readFileSync(args[0], "utf8");
        let output = GCodeToNC(data);
        fs.writeFileSync(args[1], String(output));
        console.log("Success: File converted!");
    } else {
        console.log("Error: File not found!");
    }
} else {
    console.log("Error: No file specified!");
    console.log("Usage: ts-node index.ts <file.gcode> <output.prn>");
}