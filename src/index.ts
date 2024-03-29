import { Chip8 } from "./chip8";

const Canvas = document.getElementById("screen") as HTMLCanvasElement;
const Context = Canvas.getContext("2d") as CanvasRenderingContext2D;
const ImageData = Context.getImageData(0, 0, Canvas.width, Canvas.height);
const CanvasBuffer = ImageData.data;
const Colors = [
  [
    [255, 255, 255],
    [100, 149, 237],
  ],
  [
    [15, 56, 15],
    [255, 255, 255],
  ],
  [
    [0, 0, 0],
    [155, 188, 15],
  ],
];

let chip8 = new Chip8();
let timerId = -1;
let colorIndex = 0;

document.querySelectorAll(".controllerButton").forEach((button) =>
  button.addEventListener("click", (event) => {
    event.preventDefault();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: (button as HTMLButtonElement).value })
    );
    setTimeout(
      () =>
        document.dispatchEvent(
          new KeyboardEvent("keyup", {
            key: (button as HTMLButtonElement).value,
          })
        ),
      200
    );
  })
);

document.addEventListener("keydown", (event) => {
  switch (event.key) {
    case "1":
      chip8.Keypad[0] = 1;
      break;
    case "2":
      chip8.Keypad[1] = 1;
      break;
    case "3":
      chip8.Keypad[2] = 1;
      break;
    case "4":
      chip8.Keypad[3] = 1;
      break;
    case "q":
      chip8.Keypad[4] = 1;
      break;
    case "w":
      chip8.Keypad[5] = 1;
      break;
    case "e":
      chip8.Keypad[6] = 1;
      break;
    case "r":
      chip8.Keypad[7] = 1;
      break;
    case "a":
      chip8.Keypad[8] = 1;
      break;
    case "s":
      chip8.Keypad[9] = 1;
      break;
    case "d":
      chip8.Keypad[10] = 1;
      break;
    case "f":
      chip8.Keypad[11] = 1;
      break;
    case "z":
      chip8.Keypad[12] = 1;
      break;
    case "x":
      chip8.Keypad[13] = 1;
      break;
    case "c":
      chip8.Keypad[14] = 1;
      break;
    case "v":
      chip8.Keypad[15] = 1;
      break;
    case "y":
      chip8.dumpMemory();
      break;
    case "u":
      chip8.dumpRegisters();
      break;
    case "i":
      chip8.dumpVideo();
      break;
  }
});

document.addEventListener("keyup", (event) => {
  event.preventDefault();
  chip8.Keypad.fill(0);
});

async function start() {
  Canvas.setAttribute("tabindex", "0");
  Canvas.focus();
  const title = getTitle();
  if (!title) {
    return;
  }
  chip8 = new Chip8();
  return await loadTitle(title);
}

document
  .getElementById("romList")!
  .addEventListener("change", async (event) => {
    event.preventDefault();
    await start();
  });

document.getElementById("reset")!.addEventListener("click", async (event) => {
  event.preventDefault();
  await start();
});

document.getElementById("pause")!.addEventListener("click", (event) => {
  event.preventDefault();
  chip8.ShouldRun = !chip8.ShouldRun;
  const speed = parseInt(
    (document.getElementById("speed") as HTMLSelectElement).value
  );
  run(speed);
});

document.getElementById("speed")!.addEventListener("change", (event) => {
  event.preventDefault();
  clearTimeout(timerId);
  const speed = parseInt(
    (document.getElementById("speed") as HTMLSelectElement).value
  );
  run(speed);
});

document.getElementById("colors")!.addEventListener("change", (event) => {
  event.preventDefault();
  colorIndex = parseInt(
    (document.getElementById("colors") as HTMLSelectElement).value
  );
});

function getTitle() {
  const title: string = (
    document.getElementById("romList") as HTMLSelectElement
  ).value;
  if (!title) {
    return "";
  }

  return title;
}

async function getRom(title: string): Promise<ArrayBuffer> {
  const rom = await fetch(`/roms/${title}`);
  if (rom.status !== 200) {
    throw new Error(`Failed to retrieve ROM ${title}`);
  }
  return await rom.arrayBuffer();
}

async function loadTitle(title: string) {
  const rom: ArrayBuffer = await getRom(title);
  chip8.loadRom(rom);
  const speed = parseInt(
    (document.getElementById("speed") as HTMLSelectElement).value
  );
  run(speed);
}

function run(speed: number) {
  if (chip8.isRunning()) {
    for (let i = 0; i < speed * 2; ++i) {
      chip8.step();
      if (chip8.DrawFlag) {
        chip8.DrawFlag = false;
        draw();
      }
    }
  } else {
    clearTimeout(timerId);
    return;
  }

  timerId = setTimeout(() => run(speed), 0);
}

function writePixel(x: number, y: number, color: number[]) {
  const offset = Canvas.width * 4 * y + x * 4;

  CanvasBuffer[offset] = color[0];
  CanvasBuffer[offset + 1] = color[1];
  CanvasBuffer[offset + 2] = color[2];
  CanvasBuffer[offset + 3] = 255;
}

function draw() {
  for (let y = 0; y < chip8.VideoHeight; ++y) {
    for (let x = 0; x < chip8.VideoWidth; ++x) {
      const color = chip8.shouldDrawColor(x, y)
        ? Colors[colorIndex][0]
        : Colors[colorIndex][1];
      writePixel(x, y, color);
    }
  }

  Context!.putImageData(ImageData, 0, 0);
}
