export class Chip8 {
    readonly VideoHeight = 0x20;
    readonly VideoWidth = 0x40;
    readonly ProgramStartAddress = 0x200;
    readonly CharSize = 0x5;
    readonly Fonts = new Uint8Array(
        [
            0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
            0x20, 0x60, 0x20, 0x20, 0x70, // 1
            0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
            0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
            0x90, 0x90, 0xF0, 0x10, 0x10, // 4
            0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
            0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
            0xF0, 0x10, 0x20, 0x40, 0x40, // 7
            0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
            0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
            0xF0, 0x90, 0xF0, 0x90, 0x90, // A
            0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
            0xF0, 0x80, 0x80, 0x80, 0xF0, // C
            0xE0, 0x90, 0x90, 0x90, 0xE0, // D
            0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
            0xF0, 0x80, 0xF0, 0x80, 0x80  // F
        ]
    );

    DrawFlag: boolean = false;
    I = 0;
    PC = this.ProgramStartAddress;
    SP = 0;
    DT = 0;
    ST = 0;
    Stack: Uint16Array = new Uint16Array(16);
    Registers: Uint8Array = new Uint8Array(16);
    Memory: Uint8Array = new Uint8Array(4096);
    Keypad: Uint8Array = new Uint8Array(16);
    Video: Uint8Array = new Uint8Array(2048);
    Opcode = 0;
    ShouldRun = true;
    ProgramSize: number = 0;

    get VF(): number {
        return this.Registers[0xF];
    }

    set VF(value: number) {
        this.Registers[0xF] = value;
    }

    constructor(debug: boolean = false) {
        if (debug) {
            this.debugConsole = (msg: string) => console.debug(msg);
        }


        for (let i = 0; i < this.Fonts.length; ++i) {
            this.Memory[i] = this.Fonts[i];
        }
    }

    shouldDrawColor = (x: number, y: number) => this.Video[x + (this.VideoWidth * y)] !== 0;
    randomByte = () => Math.random() * Math.floor(0xFF);
    isRunning = () => this.PC < this.ProgramSize + this.ProgramStartAddress && this.ShouldRun;
    private readonly debugConsole = (msg: string) => {
    };

    loadRom(bytes: ArrayBuffer) {
        const uintBuffer = new Uint8Array(bytes);
        if (uintBuffer.length === 0) {
            throw new Error("Failed to load rom.")
        }
        for (let i = 0; i < uintBuffer.length; ++i) {
            this.Memory[i + this.ProgramStartAddress] = uintBuffer[i];
        }
        this.ProgramSize = bytes.byteLength + this.ProgramStartAddress;
    }

    step() {
        this.Opcode = (this.Memory[this.PC] << 8 | this.Memory[this.PC + 1]);
        this.PC += 2;
        this.execute();

        if (this.DT > 0) {
            --this.DT;
        }

        if (this.ST > 0) {
            --this.ST;
        }
    }

    execute() {
        const vx = (this.Opcode & 0x0F00) >> 8;
        const vy = (this.Opcode & 0x00F0) >> 4;
        const n = this.Opcode & 0x000F;
        const nn = this.Opcode & 0x00FF;
        const nnn = this.Opcode & 0x0FFF;

        switch (this.Opcode & 0xF000) {
            case 0x0000:
                switch (n) {
                    case 0x0:
                        this.Video.fill(0);
                        this.DrawFlag = true;
                        this.debugConsole(`0x${this.Opcode.toString(16)} -> 00EO: CLS - Clear screen`);
                        break;

                    case 0xE:
                        this.PC = this.Stack[--this.SP];
                        this.debugConsole(`0x${this.Opcode.toString(16)} -> 00EE: RET - Return`);
                        break;

                    default:
                        this.debugConsole(`0x${this.Opcode.toString(16)} -> Unknown 0x00 this.Opcode`);
                        break;
                }
                break;

            case 0x1000:
                this.PC = nnn;
                this.debugConsole(`0x${this.Opcode.toString(16)} -> 1NNN: JP addr - Jump to address`);
                break;

            case 0x2000:
                this.Stack[this.SP++] = this.PC;
                this.PC = nnn;
                this.debugConsole(`0x${this.Opcode.toString(16)} -> 2NNN: CALL addr - Call subroutine at address`);
                break;

            case 0x3000:
                if (this.Registers[vx] === nn) {
                    this.PC += 2;
                }
                this.debugConsole(`0x${this.Opcode.toString(16)} -> 3XKK: SE Vx, byte - Skip next instruction if Vx = byte`);
                break;

            case 0x4000:
                if (this.Registers[vx] !== nn) {
                    this.PC += 2;
                }
                this.debugConsole(`0x${this.Opcode.toString(16)} -> 4XKK: SNE Vx, byte - Skip next instruction if Vx != byte`);
                break;

            case 0x5000:
                if (this.Registers[vx] === this.Registers[vy]) {
                    this.PC += 2;
                }
                this.debugConsole(`0x${this.Opcode.toString(16)} -> 5XY0: SE Vx, Vy - Skip next instruction if Vx = Vy`);
                break;

            case 0x6000:
                this.Registers[vx] = nn;
                this.debugConsole(`0x${this.Opcode.toString(16)} -> 6XKK: LD Vx, byte - Set Vx = byte`);
                break;

            case 0x7000:
                this.Registers[vx] = (this.Registers[vx] + nn) & 0xFF;
                this.debugConsole(`0x${this.Opcode.toString(16)} -> 7XKK: ADD Vx, byte - Add byte to Vx`);
                break;

            case 0x8000:
                switch (n) {
                    case 0x0:
                        this.Registers[vx] = this.Registers[vy];
                        this.debugConsole(`0x${this.Opcode.toString(16)} -> 8XY0: LD Vx, Vy - Set Vx = Vy`);
                        break;

                    case 0x1:
                        this.Registers[vx] |= this.Registers[vy];
                        this.debugConsole(`0x${this.Opcode.toString(16)} -> 8XY1: OR Vx, Vy - Set Vx = Vx OR Vy`);
                        break;

                    case 0x2:
                        this.Registers[vx] &= this.Registers[vy];
                        this.debugConsole(`0x${this.Opcode.toString(16)} -> 8XY2 AND Vx, Vy - Set Vx = Vx AND Vy`);
                        break;

                    case 0x3:
                        this.Registers[vx] ^= this.Registers[vy];
                        this.debugConsole(`0x${this.Opcode.toString(16)} -> 8XY3: XOR Vx, Vy - Set Vx = Vx XOR Vy`);
                        break;

                    case 0x4: {
                        const result = this.Registers[vx] + this.Registers[vy];
                        this.VF = result > 0xFF ? 1 : 0;
                        this.Registers[vx] = result & 0xFF;
                        this.debugConsole(`0x${this.Opcode.toString(16)} -> 8XY4: ADD Vx, Vy - Set Vx = Vx + Vy, Set VF = carry`);
                    }
                        break;

                    case 0x5:
                        this.VF = this.Registers[vx] > this.Registers[vy] ? 1 : 0;
                        this.Registers[vx] -= this.Registers[vy];
                        this.debugConsole(`0x${this.Opcode.toString(16)} -> 8XY5: SUB Vx, Vy - Set Vx = Vx - Vy, Set VF = not borrow`);
                        break;

                    case 0x6:
                        this.VF = this.Registers[vx] & 0x1;
                        this.Registers[vx] >>= 1;
                        this.debugConsole(`0x${this.Opcode.toString(16)} -> 8XY6: SHR Vx - Set Vx = Vx SHR 1`);
                        break;

                    case 0x7:
                        this.VF = this.Registers[vx] < this.Registers[vy] ? 1 : 0;
                        this.Registers[vx] = this.Registers[vy] - this.Registers[vx];
                        this.debugConsole(`0x${this.Opcode.toString(16)} -> 8XY7: SUB Vx, Vy - Set Vx = Vy - Vx, Set VF = not borrow`);
                        break;

                    case 0xE:
                        this.VF = (this.Registers[vx] & 0x80) >> 7;
                        this.Registers[vx] <<= 1;
                        this.debugConsole(`0x${this.Opcode.toString(16)} -> 8XYE - SHL Vx - Set Vx = Vx SHL 1`);
                        break;

                    default:
                        this.debugConsole(`Unknown 0x8000 this.Opcode: {this.Opcode.toString(16)}.`);
                        break;
                }
                break;

            case 0x9000:
                if (this.Registers[vx] !== this.Registers[vy]) {
                    this.PC += 2;
                }
                this.debugConsole(`0x${this.Opcode.toString(16)} -> 9XY0: SNE Vx, Vy - Skip next instruction if Vx != Vy`);
                break;

            case 0xA000:
                this.I = nnn;
                this.debugConsole(`0x${this.Opcode.toString(16)} -> ANNN: LD I, addr - Set I = nnn`);
                break;

            case 0xB000:
                this.PC = this.Registers[nnn];
                this.debugConsole(`0x${this.Opcode.toString(16)} -> BNNN: JP V0, addr - Jump to address V0 + addr`);
                break;

            case 0xC000:
                this.Registers[vx] = (this.randomByte() & nn);
                this.debugConsole(`0x${this.Opcode.toString(16)} -> CXKK: RND Vx, byte - Set Vx = random byte AND byte`);
                break;

            case 0xD000:
                this.VF = 0;

                for (let y = 0; y < n; ++y) {
                    const pixel = this.Memory[this.I + y];
                    for (let x = 0; x < 8; ++x) {
                        if (pixel & (0x80 >> x)) {
                            const videoIndex = (this.Registers[vx] + x) + ((this.Registers[vy] + y) * this.VideoWidth);
                            this.VF |= this.Video[videoIndex];
                            this.Video[videoIndex] ^= 1;
                        }
                    }
                }

                this.DrawFlag = true;
                this.debugConsole(`0x${this.Opcode.toString(16)} -> DXYN: DRW Vx, Vy, nibble - Display n-byte sprite starting at I to coordinates (Vx, Vy), Set VF = collision`);
                break;

            case 0xE000:
                switch (nn) {
                    case 0x9E:
                        if (this.Keypad[this.Registers[vx]]) {
                            this.PC += 2;
                        }
                        this.debugConsole(`0x${this.Opcode.toString(16)} -> EX9E: SKP Vx - Skip next instruction if key with the value of Vx is pressed`);
                        break;

                    case 0xA1:
                        if (!this.Keypad[this.Registers[vx]]) {
                            this.PC += 2;
                        }
                        this.debugConsole(`0x${this.Opcode.toString(16)} -> EXA1: SKNP Vx - Skip next instruction if key with the value of Vx is not pressed`);
                        break;

                    default:
                        this.debugConsole(`Unknown 0xE000 this.Opcode: ${this.Opcode.toString(16)}`);
                        break;
                }

                break;

            case 0xF000:
                switch (nn) {
                    case 0x07:
                        this.Registers[vx] = this.DT;
                        this.debugConsole(`0x${this.Opcode.toString(16)} -> FX07: LD Vx, DT - Set Vx = delay timer`);
                        break;

                    case 0x0A:
                        if (this.Keypad[0]) {
                            this.Registers[vx] = 0;
                        } else if (this.Keypad[1]) {
                            this.Registers[vx] = 1;
                        } else if (this.Keypad[2]) {
                            this.Registers[vx] = 2;
                        } else if (this.Keypad[3]) {
                            this.Registers[vx] = 3;
                        } else if (this.Keypad[4]) {
                            this.Registers[vx] = 4;
                        } else if (this.Keypad[5]) {
                            this.Registers[vx] = 5;
                        } else if (this.Keypad[6]) {
                            this.Registers[vx] = 6;
                        } else if (this.Keypad[7]) {
                            this.Registers[vx] = 7;
                        } else if (this.Keypad[8]) {
                            this.Registers[vx] = 8;
                        } else if (this.Keypad[9]) {
                            this.Registers[vx] = 9;
                        } else if (this.Keypad[10]) {
                            this.Registers[vx] = 10;
                        } else if (this.Keypad[11]) {
                            this.Registers[vx] = 11;
                        } else if (this.Keypad[12]) {
                            this.Registers[vx] = 12;
                        } else if (this.Keypad[13]) {
                            this.Registers[vx] = 13;
                        } else if (this.Keypad[14]) {
                            this.Registers[vx] = 14;
                        } else if (this.Keypad[15]) {
                            this.Registers[vx] = 15;
                        } else {
                            this.PC -= 2;
                        }
                        this.debugConsole(`0x${this.Opcode.toString(16)} -> FX0A: LD Vx, K - Wait for key press and store the value into Vx`);
                        break;

                    case 0x15:
                        this.DT = this.Registers[vx];
                        this.debugConsole(`0x${this.Opcode.toString(16)} -> FX15: LD DT, Vx - Set delay timer = Vx`);
                        break;

                    case 0x18:
                        this.ST = this.Registers[vx];
                        this.debugConsole(`0x${this.Opcode.toString(16)} -> FX18: LD ST, Vx - Set sound timer = Vx`);
                        break;

                    case 0x1E:
                        this.I += this.Registers[vx];
                        this.debugConsole(`0x${this.Opcode.toString(16)} -> FX1E: Add I, Vx - Set I = I + Vx`);
                        break;

                    case 0x29:
                        this.I = ((this.CharSize * this.Registers[vx]));
                        this.debugConsole(`0x${this.Opcode.toString(16)} -> FX29: LD F, Vx - Set I = location of sprite for digit Vx`);
                        break;

                    case 0x33: {
                        const result = this.Registers[vx];
                        this.VF = this.I + result > 0xFFF ? 1 : 0;
                        this.Memory[this.I] = 0xFF & ((result % 1000) / 100);
                        this.Memory[this.I + 1] = 0xFF & ((result % 100) / 10);
                        this.Memory[this.I + 2] = 0xFF & (result % 10);
                        this.debugConsole(`0x${this.Opcode.toString(16)} -> FX33: LD B, Vx - Store BCD (Binary-Coded Decimal) representation of Vx in memory locations I, I + 1, and I + 2`);
                    }
                        break;

                    case 0x55:
                        for (let offset = 0; offset <= vx; ++offset) {
                            this.Memory[this.I + offset] = this.Registers[offset];
                        }
                        this.debugConsole(`0x${this.Opcode.toString(16)} -> FX55: LD [I], Vx - Store V0~Vx in memory starting at location I`);
                        break;

                    case 0x65:
                        for (let offset = 0; offset <= vx; ++offset) {
                            this.Registers[offset] = this.Memory[this.I + offset];
                        }
                        this.debugConsole(`0x${this.Opcode.toString(16)} -> FX65: LD Vx, [I] - Read this.Registers V0~Vx from memory starting at location I`);
                        break;

                    default:
                        this.debugConsole(`Unknown 0xF000 this.Opcode: ${this.Opcode.toString(16)}`);
                        break;
                }

                break;


            default:
                this.debugConsole(`Unknown this.Opcode: ${this.Opcode.toString(16)}`);
                break;
        }

    }

    dumpRegisters() {
        console.debug(`
        Opcode -> ${this.Opcode}
        PC -> ${this.PC}
        I -> ${this.I}
        SP -> ${this.SP}
        Register[0] -> ${this.Registers[0]}
        Register[1] -> ${this.Registers[1]}
        Register[2] -> ${this.Registers[2]}
        Register[3] -> ${this.Registers[3]}
        Register[4] -> ${this.Registers[4]}
        Register[5] -> ${this.Registers[5]}
        Register[6] -> ${this.Registers[6]}
        Register[7] -> ${this.Registers[7]}
        Register[8] -> ${this.Registers[8]}
        Register[9] -> ${this.Registers[9]}
        Register[10] -> ${this.Registers[10]}
        Register[11] -> ${this.Registers[11]}
        Register[12] -> ${this.Registers[12]}
        Register[13] -> ${this.Registers[13]}
        Register[14] -> ${this.Registers[14]}
        VF -> ${this.Registers[15]}`
        );
    }

    dumpMemory() {
        let out = '\n';
        for (let i = 0; i < this.Memory.length; ++i) {
            out += `Memory[${i}] -> ${this.Memory[i]}\n`;
        }
        console.debug(out)
    }

    dumpVideo() {
        let out = '\n';
        for (let i = 0; i < this.Video.length; ++i) {
            out += `Video[${i}] -> ${this.Video[i]}\n`;
        }
        console.debug(out)
    }
}
