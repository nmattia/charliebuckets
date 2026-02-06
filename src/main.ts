import { hydrateSVG } from "./render";
import "./style.css";
const fileInput = document.getElementById("fileInput") as HTMLInputElement;
const output = document.getElementById("output") as HTMLDivElement;
const flip = document.getElementById("flip") as HTMLInputElement;

function parseFile(content: string): null | SVGSVGElement {
  // Parse the SVG
  const parser = new DOMParser();
  const svgRoot = parser.parseFromString(
    content,
    "image/svg+xml",
  ).documentElement;

  if (!(svgRoot instanceof SVGSVGElement)) {
    console.warn("Error parsing SVG");
    return null;
  }

  return svgRoot;
}

fileInput.addEventListener("change", () => {
  const files = fileInput.files;
  if (!files || files.length <= 0) {
    console.warn("No files uploaded");
    return;
  }

  if (files.length > 1) {
    console.warn("Too many files uploaded");
    return;
  }

  const file = files[0];

  const reader = new FileReader();
  reader.onload = (e) => {
    const svgText = e.target?.result as string;

    const svg = parseFile(svgText);
    if (!svg) {
      console.warn("nope");
      return;
    }

    // Clear output and append the SVG
    output.innerHTML = "";
    output.appendChild(svg);

    hydrateSVG(svg);
    if (flip.checked) {
      svg.setAttribute("data-flipped", "");
    } else {
      svg.removeAttribute("data-flipped");
    }
  };

  reader.readAsText(file);
});
