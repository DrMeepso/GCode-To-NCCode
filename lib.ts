// regex to get the g command from a line
// g<anynumber >

export function GCodeToNC(data: String): String {

    let lines: String[] = data.split("\n"); // split the data into lines
    let outputLines: String[] = []; // create an array to store the output lines

    let isSpinning:boolean = false;

    outputLines.push("%"); // set the measurement system to mm
    outputLines.push("O00000001"); // set program number
    outputLines.push("(Converted by GCodeToNC)"); // add a header to the file
    outputLines.push("G00X0.0Y0.0Z0.0"); // move to the origin
    outputLines.push("G17"); // select the XY plane

    for (let i = 0; i < lines.length; i++) {

        let line = lines[i];
        let convert = convertLine(line, i, isSpinning, (f: boolean) => { isSpinning = f; });
        for (let j = 0; j < convert.length; j++) {
            outputLines.push(convert[j]);
        }
    }

    console.log(`Info: Converted ${lines.length} lines!`)
    console.log("Info: Conversion complete!")

    outputLines.push("M05"); // turn off the spindle
    outputLines.push("M02"); // end of program
    outputLines.push("%"); // end of file
    
    return outputLines.join("\r"); // carraige return for each block of GCode we feed the machine (NC) with

}

function convertLine(line: String, lineNumber: number, isSpinning: boolean, setSpinning: (f:boolean) => void): String[] // an array of lines
{

    let strings: String[] = [];

    let gCode = line.match(/g\d+/i); // get the g command from the line
    if (gCode) {

        let comment = line.match(/;.*/i);
        if (comment) {
            strings.push(`(${comment[0].replace(";", "").trim()})`);
        }

        // for rapid & linear moves
        function doGLinCode(code: string): string {
            let prams = parseGLinePrams(line, lineNumber, ["g", "f", "x", "y", "z", "s"], ["s"]);
            let convertedLine = `${code}`
            for (let i = 0; i < prams.length; i++) {
                if (prams[i].name == "x")
                    convertedLine += `X${prams[i].value}`

                if (prams[i].name == "y")
                    convertedLine += `Y${prams[i].value}`

                if (prams[i].name == "z")
                    convertedLine += `Z${prams[i].value}`

                if (prams[i].name == "f")
                    convertedLine += `F${prams[i].value}`

                if (prams[i].name == "s")
                {
                    convertedLine += `S${prams[i].value}`
                    if (parseFloat(prams[i].value.toString()) > 0 && !isSpinning)
                    {
                        setSpinning(true);
                        strings.push("(Spindle on & wait 2 seconds)");
                        strings.push("M03");
                        strings.push("G04P2.0"); // dwell for 2 seconds
                    }
                    if (parseFloat(prams[i].value.toString()) == 0 && isSpinning)
                    {
                        setSpinning(false);
                        strings.push("(Spindle off & wait 2 seconds)");
                        strings.push("M05");
                        strings.push("G04P2.0"); // dwell for 2 seconds
                    }
                }
            }
            return convertedLine;
        }

        function doGDwellCode(code: string): string {
            let prams = parseGLinePrams(line, lineNumber, ["g", "p", "x"], [""]);
            let convertedLine = `${code}`
            for (let i = 0; i < prams.length; i++) {
                if (prams[i].name == "p")
                    convertedLine += `P${prams[i].value}`
                if (prams[i].name == "x")
                    convertedLine += `X${prams[i].value}`
            }
            return convertedLine;
        }

        switch (gCode[0].toLowerCase()) {
            case "g0": // rapid move
                strings.push(doGLinCode("G00"));
                break;

            case "g1": // linear move
                strings.push(doGLinCode("G01"));
                break;

            // set the measurement system
            case "g20":
            case "g21":
                strings.push(gCode[0].toUpperCase());
                if (gCode[0].toLowerCase() == "g20")
                    console.log("Warning: G20 (Inches) was selected, I am not sure if this is supported by the machine");
                else
                    console.log("Info: G21 (mm) was selected!");
                break;

            // circular interpolation G02 & G03 (clockwise and counter clockwise)
            case "g17": // select the XY plane
            case "g18": // select the XZ plane
            case "g19": // select the YZ plane
            case "g02": // clockwise
            case "g03": // counter clockwise
                throw new Error(`Error: Circular interpolation is not supported, line: ${lineNumber + 1}`); // will add support for this later
                break;

            // dwell
            case "g04":
                strings.push(doGDwellCode("G04"));
                break;

            default:
                console.log(`Warning: ${gCode[0]} is not supported, line: ${lineNumber + 1}`);
                break;
            
        }

    }

    return strings;

}

interface linePram {
    name: String,
    value: String
};

function parseGLinePrams(line: String, lineIndex: number, commands: string[], dontDecimal: string[]): linePram[] {

    let prams: linePram[] = [];

    // break the line into characters
    let chars = line.split("");

    let currentCommand = ""
    let tmpValue = "";
    let willBreak = false;
    for (let i = 0; i < chars.length; i++) {
        if (willBreak)
            break;
        if (chars[i] == ";")
            willBreak = true;
        if (chars[i] == " ")
            continue; // skip spaces
        if (commands.includes(chars[i].toLowerCase()) || chars[i] == ";") {

            if (currentCommand == "" && tmpValue == "") {
                currentCommand = chars[i].toLowerCase();
                continue;
            }


            // add a decimal point if there isnt one so we arnt working in 100th of a mm
            let stringValue = "";
            let value: number = parseFloat(tmpValue);
            if (!Number.isNaN(value) && !value.toString().includes(".")) {
                stringValue = value.toString() + ".0";
            } else {
                stringValue = value.toString();
            }

            // remove the decimal point if the command is spindle speed and not a spatial command
            if (dontDecimal.includes(currentCommand)) {
                stringValue = value.toString();
            }

            prams.push({ name: currentCommand, value: stringValue });

            if (Number.isNaN(parseFloat(tmpValue)))
                console.log(`Error: ${currentCommand} ${tmpValue} is not a number, line: ${lineIndex + 1}`);

            currentCommand = chars[i].toLowerCase();
            tmpValue = "";
        } else {
            tmpValue += chars[i];
        }
    }

    // add a decimal point if there isnt one so we arnt working in 100th of a mm
    let stringValue = "";
    let value: number = parseFloat(tmpValue);
    if (!Number.isNaN(value) && !value.toString().includes(".")) {
        stringValue = value.toString() + ".0";
    } else {
        stringValue = value.toString();
    }

    // remove the decimal point if the command is spindle speed and not a spatial command
    if (currentCommand == "s") {
        stringValue = value.toString();
    }

    prams.push({ name: currentCommand, value: stringValue });

    return prams;

}

