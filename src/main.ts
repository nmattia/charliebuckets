import { grid, pio } from "./patterns";
import type { PinPair } from "./patterns";
const fileInput = document.getElementById("fileInput") as HTMLInputElement;
const output = document.getElementById("output") as HTMLDivElement;

const activateInNet = (event: MouseEvent) => {
  const elem = event.target;
  if (!elem || !(elem instanceof SVGGraphicsElement)) {
    return;
  }
  elem
    .ownerSVGElement!.querySelectorAll(
      `[data-color="${elem.dataset?.color}"][data-pin-ix="${elem.dataset?.pinIx}"]`,
    )
    .forEach((e) => e.setAttribute("data-yes", "true"));
};
const deactivateInNet = (event: MouseEvent) => {
  const elem = event.target;
  if (!elem || !(elem instanceof SVGGraphicsElement)) {
    return;
  }
  elem
    .ownerSVGElement!.querySelectorAll(
      `[data-color="${elem.dataset?.color}"][data-pin-ix="${elem.dataset?.pinIx}"]`,
    )
    .forEach((e) => e.removeAttribute("data-yes"));
};

function hydrateSVG(svgRoot: SVGSVGElement) {
  // Get the screen CTM of the root SVG to transform back to SVG coordinates
  const rootInverse = svgRoot.getScreenCTM()?.inverse();
  if (!rootInverse) {
    console.warn("No root CTM");
    return null;
  }

  const radio = document.querySelector('input[name="pattern"]:checked');
  if (!radio || !(radio instanceof HTMLInputElement)) {
    console.warn("No radio input:", radio);
    return;
  }

  const patternTypes = {
    pio: pio,
    grid: grid,
  } as Record<string, (_: number) => Generator<PinPair>>;

  const patternName = radio.value;
  const patternGen = patternTypes[patternName];

  if (!patternGen) {
    console.warn("Unknown pattern type", patternName);
  }

  const byColor: Record<string, [SVGGraphicsElement]> = {};
  const allElems = svgRoot.querySelectorAll("[cx][cy]");

  for (let elem of allElems) {
    if (!(elem instanceof SVGGraphicsElement)) {
      console.warn("Element is not an SVGGraphicsElement:", elem);
      return null;
    }
    // Bucket the elements by stroke color
    const strokeColor = getComputedStyle(elem).getPropertyValue("stroke");
    byColor[strokeColor] = byColor[strokeColor] ?? [];
    byColor[strokeColor].push(elem);
  }

  for (let color in byColor) {
    // Create group to hold both signs
    const colorGroup = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g",
    );
    colorGroup.setAttribute("data-color", color); // not used in look up but useful

    const tot = byColor[color].length;
    // here we solve for p where n < p(p-1) where n is the number
    // of elements and p is the number of pins.
    // -> p2 - p - n < 0 -> zero at p = (1 + sqrt(1 + 4n))/2
    const nPins = Math.ceil((1 + Math.sqrt(1 + 4 * tot)) / 2);
    const patterns = patternGen(nPins);

    svgRoot.append(colorGroup);
    // Find all elements with cx and cy attributes
    for (let element of byColor[color]) {
      const svgEl = element as SVGGraphicsElement;
      const cx = parseFloat(element.getAttribute("cx")!);
      const cy = parseFloat(element.getAttribute("cy")!);
      const elementId = element.getAttribute("id") || "";

      // Get the element's CTM (to screen/viewport coordinates)
      const ctm = svgEl.getScreenCTM();
      if (!ctm) {
        console.warn("No CTM for element", elementId);
        continue;
      }

      // Transform cx/cy to screen coordinates
      const svgPoint = svgRoot.createSVGPoint();
      svgPoint.x = cx;
      svgPoint.y = cy;
      const svgCoords = svgPoint
        .matrixTransform(ctm)
        .matrixTransform(rootInverse);

      // Create group to hold both signs
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("data-orig", elementId);
      group.setAttribute(
        "transform",
        `translate(${svgCoords.x}, ${svgCoords.y})`,
      );

      const SIGN_WIDTH = 4;
      const SIGN_DIST = 5;

      // Create + sign (on the left)
      const plusPath = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );

      plusPath.setAttribute(
        "d",
        `M ${-SIGN_WIDTH / 2} 0 L ${SIGN_WIDTH / 2} 0 M 0 ${-SIGN_WIDTH / 2} L 0 ${SIGN_WIDTH / 2}`,
      );

      const pattern = patterns.next();

      if (pattern.done) {
        console.warn("big error");
        return;
      }

      plusPath.setAttribute("stroke", "red");
      plusPath.setAttribute("stroke-width", "1");
      plusPath.setAttribute("transform", `translate(${-SIGN_DIST}, 0)`);
      plusPath.setAttribute("data-pin-ix", pattern.value.high.toString());
      plusPath.setAttribute("data-color", color);
      plusPath.onmouseenter = activateInNet;
      plusPath.onmouseleave = deactivateInNet;

      // Create - sign (on the right)
      const minusPath = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );

      minusPath.setAttribute(
        "d",
        `M ${-SIGN_WIDTH / 2} 0 L ${SIGN_WIDTH / 2} 0`,
      );
      minusPath.setAttribute("stroke", "blue");
      minusPath.setAttribute("stroke-width", "1");
      minusPath.setAttribute("transform", `translate(${SIGN_DIST}, 0)`);
      minusPath.setAttribute("data-pin-ix", pattern.value.low.toString());
      minusPath.setAttribute("data-color", color);
      minusPath.onmouseenter = activateInNet;
      minusPath.onmouseleave = deactivateInNet;

      // Add paths to group
      group.appendChild(plusPath);
      group.appendChild(minusPath);

      // Append group to SVG
      colorGroup.append(group);
    }
  }
  // // Create the `style` element in the SVG namespace
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  const node = document.createTextNode(
    "path { opacity: 20%; } path[data-yes] { opacity: 100%; }",
  );
  style.appendChild(node);
  // Append the style element to the SVG element
  svgRoot.appendChild(style);
}

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
  };

  reader.readAsText(file);
});
