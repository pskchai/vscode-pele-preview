import { toBase64 } from 'js-base64';
import { vscode } from '../utility/vscode';

/**
 * Creates a PNG image from the SVG diagram
 */
export async function exportPng(theme?: string) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const canvas = document.createElement('canvas');

    const element = document.getElementById("mermaid-diagram");
      if (!element) return;
      
    const svg = document.querySelector<HTMLElement>('#mermaid-diagram svg');
    if (!svg) {
      throw new Error('svg not found');
    }

    const box = svg.getBoundingClientRect();
    const multiplier = 2;
    canvas.width = box.width * multiplier;
    canvas.height = box.height * multiplier;
    
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get canvas context');
    }
    
    // Set background color based on theme
    context.fillStyle = theme?.includes("dark") ? "#171719" : "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Create image from SVG
    const image = new Image();
    
    // Handle image load completion
    image.onload = () => {
      // Draw the image with proper scaling
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      
      // Get PNG base64 data and send to extension
      const pngBase64 = canvas.toDataURL('image/png').split(',')[1];
      
      vscode.postMessage({
        type: "exportPng",
        pngBase64: pngBase64
      });
      
      // Clean up
      canvas.width = 0;
      canvas.height = 0;
    };
    
    // Handle potential loading errors
    image.onerror = (err) => {
      console.error("Error loading SVG image:", err);
      vscode.postMessage({
        type: "error",
        message: "Error loading diagram for export. Please try again."
      });
    };
    
    // Load the image from SVG
    image.src = `data:image/svg+xml;base64,${await getBase64SVG(svg, canvas.width, canvas.height)}`;
  } catch (error) {
    console.error("Error preparing PNG export:", error);
    vscode.postMessage({
      type: "error",
      message: `Error exporting PNG: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}


/**
 * Creates an SVG image from the diagram
 */
export async function exportSvg() {
  try {
    const svg = getSvgElement() as HTMLElement;
    if (!svg) {
      throw new Error('SVG element not found');
    }

    const svgBase64 = await getBase64SVG(svg);
    
    vscode.postMessage({
      type: "exportSvg",
      svgBase64: svgBase64
    });
  } catch (error) {
    console.error("Error exporting SVG:", error);
    vscode.postMessage({
      type: "error",
      message: `Error exporting SVG: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

/**
 * Converts SVG element to base64 string
 */
export const getBase64SVG = async (svg?: HTMLElement, width?: number, height?: number): Promise<string> => {
  if (svg) {
    // Create a clone to prevent modifying the original SVG
    svg = svg.cloneNode(true) as HTMLElement;
  }
  
  // Set dimensions if provided
  height && svg?.setAttribute('height', `${height}px`);
  width && svg?.setAttribute('width', `${width}px`);
  
  if (!svg) {
    svg = getSvgElement() as HTMLElement;
  }
  
  if (!svg) {
    throw new Error('SVG element not found');
  }

  return toBase64(svg.outerHTML);
};

/**
 * Gets the SVG element from the document
 */
export const getSvgElement = (): HTMLElement | null => {
  const svgElement = document.querySelector('#mermaid-diagram svg')?.cloneNode(true) as HTMLElement;
  if (svgElement) {
    svgElement.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  }
  return svgElement;
};
