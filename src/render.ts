import { grid, pio } from "./patterns";
import type { PinPair } from "./patterns";

const activateInNet = (event: MouseEvent) => {
  const elem = event.target;
  if (!elem || !(elem instanceof SVGGraphicsElement)) {
    return;
  }
  elem
    .ownerSVGElement!.querySelectorAll(
      `[data-bucket-id="${elem.dataset?.bucketId}"][data-pin-ix="${elem.dataset?.pinIx}"]`,
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
      `[data-bucket-id="${elem.dataset?.bucketId}"][data-pin-ix="${elem.dataset?.pinIx}"]`,
    )
    .forEach((e) => e.removeAttribute("data-yes"));
};

const SIGN_WIDTH = 4;
const SIGN_DIST = 5;

const mkPlus = (): SVGPathElement => {
  // Create + sign (on the left)
  const plusPath = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );

  plusPath.setAttribute(
    "d",
    `M ${-SIGN_WIDTH / 2} 0 L ${SIGN_WIDTH / 2} 0 M 0 ${-SIGN_WIDTH / 2} L 0 ${SIGN_WIDTH / 2}`,
  );

  plusPath.setAttribute("stroke", "red");
  plusPath.setAttribute("stroke-width", "1");
  plusPath.setAttribute("transform", `translate(${-SIGN_DIST}, 0)`);
  plusPath.onmouseenter = activateInNet;
  plusPath.onmouseleave = deactivateInNet;

  return plusPath;
};

const mkMinus = (): SVGPathElement => {
  // Create - sign (on the right)
  const minusPath = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );

  minusPath.setAttribute("d", `M ${-SIGN_WIDTH / 2} 0 L ${SIGN_WIDTH / 2} 0`);
  minusPath.setAttribute("stroke", "blue");
  minusPath.setAttribute("stroke-width", "1");
  minusPath.setAttribute("transform", `translate(${SIGN_DIST}, 0)`);
  minusPath.onmouseenter = activateInNet;
  minusPath.onmouseleave = deactivateInNet;

  return minusPath;
};

function mkElementOverlay(
  el: SVGGraphicsElement,
  hiix: string,
  loix: string,
  bucket: string,
): SVGGElement {
  const elementId = el.getAttribute("id") || "";

  // Create group to hold both signs
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("data-orig", elementId);

  const plusPath = mkPlus();
  plusPath.setAttribute("data-pin-ix", hiix);
  plusPath.setAttribute("data-bucket-id", bucket);
  const minusPath = mkMinus();
  minusPath.setAttribute("data-pin-ix", loix);
  minusPath.setAttribute("data-bucket-id", bucket);

  // Add paths to group
  group.appendChild(plusPath);
  group.appendChild(minusPath);

  return group;
}

function hydrateBucket(
  svgRoot: SVGSVGElement,
  elems: SVGElement[],
  patterns: Iterator<PinPair>,
  bucket: string,
) {
  // Get the screen CTM of the root SVG to transform back to SVG coordinates
  const rootInverse = svgRoot.getScreenCTM()?.inverse();
  if (!rootInverse) {
    console.warn("No root CTM");
    return null;
  }
  // Create group to hold both signs
  const bucketG = document.createElementNS("http://www.w3.org/2000/svg", "g");

  bucketG.setAttribute("data-bucket-id", bucket); // not used in look up but useful

  for (let element of elems) {
    const svgEl = element as SVGGraphicsElement;

    const pattern = patterns.next();

    if (pattern.done) {
      console.warn("pattern did not yield enough positions");
      return;
    }
    const hiix = pattern.value.high.toString();
    const loix = pattern.value.low.toString();
    const group = mkElementOverlay(svgEl, hiix, loix, bucket);

    const cx = parseFloat(element.getAttribute("cx")!);
    const cy = parseFloat(element.getAttribute("cy")!);

    // Get the element's CTM (to screen/viewport coordinates)
    const ctm = svgEl.getScreenCTM();
    if (!ctm) {
      console.warn("No CTM for element", element);
      continue;
    }

    // Transform cx/cy to screen coordinates
    const svgPoint = svgRoot.createSVGPoint();
    svgPoint.x = cx;
    svgPoint.y = cy;
    const svgCoords = svgPoint
      .matrixTransform(ctm)
      .matrixTransform(rootInverse);

    group.setAttribute(
      "transform",
      `translate(${svgCoords.x}, ${svgCoords.y})`,
    );

    // Append group to SVG
    bucketG.append(group);
  }

  svgRoot.append(bucketG);
}

export function hydrateSVG(svgRoot: SVGSVGElement) {
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

  const buckets: Record<string, [SVGGraphicsElement]> = {};

  // Find all elements with cx and cy attributes
  const allElems = svgRoot.querySelectorAll("[cx][cy]");

  for (let elem of allElems) {
    if (!(elem instanceof SVGGraphicsElement)) {
      console.warn("Element is not an SVGGraphicsElement:", elem);
      return null;
    }
    // Bucket the elements by stroke color
    const strokeColor = getComputedStyle(elem).getPropertyValue("fill");
    buckets[strokeColor] = buckets[strokeColor] ?? [];
    buckets[strokeColor].push(elem);
  }

  for (let bucketId in buckets) {
    const tot = buckets[bucketId].length;
    // here we solve for p where n < p(p-1), where n is the number
    // of elements and p is the number of pins.
    // -> p2 - p - n < 0 -> zero at p = (1 + sqrt(1 + 4n))/2
    const nPins = Math.ceil((1 + Math.sqrt(1 + 4 * tot)) / 2);
    const patterns = patternGen(nPins);

    hydrateBucket(svgRoot, buckets[bucketId], patterns, bucketId);
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
