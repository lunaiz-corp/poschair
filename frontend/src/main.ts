import p5 from "p5";
import * as tmImage from "@teachablemachine/image";

import reallyAnnoyingSound from "./assets/annoying_sound.flac";
import plusJakartaSansMedium from "./assets/PlusJakartaSans-Medium.ttf";
import "./style.css";

//#region Global variables
let buffer: p5.Graphics;
let maskGraphics: p5.Graphics;
let capture: p5.MediaElement;

let prediction: {
  className: string;
  probability: number;
} = { className: "", probability: 0 };

let badPositionFlag = false;
let badStartTime: number | null = null;

let plusJakartaSansMediumFont: p5.Font;
let reallyAnnoyingSoundEl: HTMLAudioElement;

let port: any;
let writer: any;
let encoder = new TextEncoder();
//#endregion

//#region Teachable Machine model initialisation
const tmUrl = "https://teachablemachine.withgoogle.com/models/pMs1-lOWP/";
const tmModel = await tmImage.load(
  tmUrl + "model.json",
  tmUrl + "metadata.json"
);
//#endregion

//#region Serial communication setup (Arduino)
declare global {
  interface Navigator {
    serial: any;
  }
}

async function openPort() {
  if (!("serial" in navigator)) {
    // Web Serial API가 지원되지 않습니다.
    alert("Web Serial API is not supported in this browser.");
    return;
  }

  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: 9600 });

  return port;
}

const button = document.createElement("button");
button.textContent = "Connect to Arduino";
button.style.position = "absolute";
button.style.top = "10px";
button.style.left = "10px";
button.style.zIndex = "1000";
document.body.appendChild(button);

button.addEventListener("click", async () => {
  port = await openPort();
  writer = port.writable.getWriter();
  button.disabled = true;
  button.textContent = "Connected to Arduino";
});
//#endregion

//#region Prediction function
async function predictImage() {
  const $capture = document.getElementById("capture") as HTMLVideoElement;
  const tmPrediction = await tmModel.predict($capture, false);

  // Get highest probability prediction
  prediction = tmPrediction.sort((a, b) => b.probability - a.probability)[0];

  console.log(
    `Predicted Class: ${prediction.className}, Probability: ${prediction.probability}`
  );

  await writer.write(encoder.encode(prediction.className));

  // Check for BAD_POSITION maintained for n seconds
  if (prediction.className === "BAD_POSITION") {
    if (badStartTime === null) {
      // First time BAD_POSITION detected
      badStartTime = performance.now();
    } else {
      // Check elapsed time
      const elapsed = performance.now() - badStartTime;
      if (elapsed >= 10000) badPositionFlag = true;
    }
  } else {
    // Reset if not BAD_POSITION
    badStartTime = null;
    badPositionFlag = false;
  }

  // TODO: Send serial data to Arduino here

  // Schedule next prediction
  setTimeout(() => {
    predictImage();
  }, 100);
}
//#endregion

//#region p5 sketch
new p5((p: p5) => {
  p.setup = async () => {
    p.createCanvas(p.windowWidth, p.windowHeight);

    // Load assets
    plusJakartaSansMediumFont = await p.loadFont(plusJakartaSansMedium);
    reallyAnnoyingSoundEl = new Audio(reallyAnnoyingSound);
    reallyAnnoyingSoundEl.loop = true;

    // Video buffer
    buffer = p.createGraphics(512, 384);

    // Mask graphics
    maskGraphics = p.createGraphics(512, 384);
    maskGraphics.noStroke();
    maskGraphics.fill(255);
    maskGraphics.ellipse(192, 192, 384, 384);

    // Create the video
    capture = p.createCapture(p.VIDEO, { flipped: true });
    capture.id("capture");
    capture.size(512, 384);
    capture.hide();

    predictImage();
  };

  p.draw = () => {
    p.textFont(plusJakartaSansMediumFont);

    if (badPositionFlag) {
      reallyAnnoyingSoundEl.paused && reallyAnnoyingSoundEl.play(); // Don't do this in school please
      p.background(239, 68, 68);
    } else {
      !reallyAnnoyingSoundEl.paused && reallyAnnoyingSoundEl.pause(); // Yes please
      p.background(80);
    }

    // Draw the video to the buffer
    buffer.image(capture, 0, 0, buffer.width, buffer.height);

    // Apply mask
    let masked = buffer.get();
    masked.mask(maskGraphics.get());
    p.image(masked, p.width / 2 - 192, p.height / 2 - 192);

    // Draw status text
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(32);
    p.fill(255);
    p.noStroke();
    p.text(
      `Position: ${prediction.className.split("_")[0]} (${(
        prediction.probability * 100
      ).toFixed(2)}%)`,
      p.width / 2,
      p.height - 100
    );
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  };
});
//#endregion
