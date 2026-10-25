<script lang="ts">
  import Panzoom from '@panzoom/panzoom';
  import { onMount } from 'svelte';
  import { vscode } from './utility/vscode'
  import ErrorMessage from './ErrorMessage.svelte';
  import Sidebar from './Sidebar.svelte';
  import { diagramContent as diagramData } from './diagramData';
  import LeftSideBar from './LeftSideBar.svelte';
  import { applyPeleTheme, PeleError, renderPele } from '../../src/renderers/pele';

  $: diagramContent = diagramData;
 
  let errorMessage = "";
  let panzoomInstance: ReturnType<typeof Panzoom> | null = null;
  let panEnabled = false;
  let hasErrorOccured= false;
  let theme = 'default';
  $: zoomLevel = 100;
  let maxZoomLevel = 5;
  let maxTextSize = 90000;
  let maxEdges = 1000;
  $: sidebarBackgroundColor = theme?.includes("dark")? "#4d4d4d" : "white";
  $: iconBackgroundColor = theme?.includes("dark") ? "#4d4d4d" : "white";
  $: svgColor = theme?.includes("dark") ? "white" : "#2329D6";
  $: shadowColor = theme?.includes("dark")? "#6b6b6b" : "#A3BDFF";

  let panEventHandlers = {
    mouseDown: null,
    mouseUp: null,
    mouseLeave: null
  }

  function renderDiagram() {

    const element = document.getElementById("mermaid-diagram");
    if (element && diagramContent) {
      try {
        errorMessage = "";
        const currentScale = panzoomInstance?.getScale() || 1;
        const currentPan = panzoomInstance?.getPan() || { x: 0, y: 0 };
        const { svg } = renderPele(diagramContent, 'diagram-graph', maxTextSize, maxEdges);
        element.innerHTML = svg;
        applyPeleTheme(element, theme.includes('dark'));
        if (theme?.includes("dark")) {
          element.style.backgroundColor= "#1e1e1e"
        } else {
          element.style.backgroundColor =  "white"
        }

        const svgElement = element.querySelector("svg");
        
        if (svgElement) {
          svgElement.style.height = "100%";
          svgElement.style.width = "auto";

          if (!panzoomInstance) {
          panzoomInstance = Panzoom(element, {
            maxScale: maxZoomLevel,
            minScale: 0.5,
            contain: "outside",
          });

          element.addEventListener("wheel", (event) => {
            panzoomInstance?.zoomWithWheel(event);
            updateZoomLevel();
          });
        }
        panzoomInstance.setOptions({ disablePan: !panEnabled });
        panzoomInstance.zoom(currentScale, { animate: false });
        panzoomInstance.pan(currentPan.x, currentPan.y, { animate: false });

          updateCursorStyle();
        }
        if(hasErrorOccured){
          vscode.postMessage({
            type: "clearError", 
          });
          hasErrorOccured = false
        }
      } catch (error) {
        errorMessage = `Syntax error in text: ${error.message || error}`;
        vscode.postMessage({
          type: "error",
          message: errorMessage,
          line: error instanceof PeleError ? error.line : undefined,
          column: error instanceof PeleError ? error.column : undefined,
        });
        hasErrorOccured = true
        element.innerHTML = "";
      }
    }
  }

  function togglePan() {
    panEnabled = !panEnabled;
    
    if (panzoomInstance) {
      // Configure panzoom with the new state
      panzoomInstance.setOptions({ 
        disablePan: !panEnabled
      });
      
      // Remove event listeners if they exist
      if (panEventHandlers.mouseDown && panEventHandlers.mouseUp) {
        // PanZoom doesn't have an 'off' method, so we need to track our own DOM event handlers
        const element = document.getElementById("mermaid-diagram");
        if (element) {
          element.removeEventListener('panzoomstart', panEventHandlers.mouseDown);
          element.removeEventListener('panzoomend', panEventHandlers.mouseUp);
        }
      }
      
      if (panEnabled) {
        const element = document.getElementById("mermaid-diagram");
        if (element) {
          // Create event handlers
          panEventHandlers.mouseDown = () => {
            element.style.cursor = 'grabbing';
            console.log("PanZoom start");
          };
          
          panEventHandlers.mouseUp = () => {
            if (panEnabled) element.style.cursor = 'grab';
            console.log("PanZoom end");
          };
          
          // Connect to PanZoom's events using DOM event listeners
          element.addEventListener('panzoomstart', panEventHandlers.mouseDown);
          element.addEventListener('panzoomend', panEventHandlers.mouseUp);
          
          // Set initial cursor
          element.style.cursor = 'grab';
        }
      } else {
        // Reset cursor when pan is disabled
        const element = document.getElementById("mermaid-diagram");
        if (element) {
          element.style.cursor = 'default';
        }
      }
    }
  }

  function updateCursorStyle() {
    const element = document.getElementById("mermaid-diagram");
    if (element) {
      element.style.cursor = panEnabled ? `grab` : 'default';
    }
  }
  function updateZoomLevel() {
    if (panzoomInstance) {
      zoomLevel = Math.round(panzoomInstance.getScale() * 100);
    }
  }

  function zoomIn() {
    panzoomInstance?.zoomIn();
    updateZoomLevel();
  }

  function zoomOut() {
    panzoomInstance?.zoomOut();
    updateZoomLevel();
  }

  function resetView() {
    panzoomInstance?.reset();
    updateZoomLevel();
  }


  window.addEventListener("message", (event) => {
    handleMessage(event.data);
  });

  function handleMessage(message) {
    const { type, content, currentTheme, isFileChange, maxZoom, maxCharLength, maxEdge } = message;
    if (type === "update") {
      maxZoomLevel = maxZoom ?? maxZoomLevel;
      maxEdges = maxEdge ?? maxEdges;
      maxTextSize = maxCharLength ?? maxTextSize;
      if (content) {
        diagramContent = content;
        theme = currentTheme;
        if (isFileChange) {
          panzoomInstance?.reset();
          updateZoomLevel();
        }
        renderDiagram();
        if (panzoomInstance) {
          panzoomInstance.setOptions({ maxScale: maxZoomLevel });
        } 
      }
    }
  }

  onMount(() => {
    const appElement = document.getElementById("app");
    const initialContent = appElement?.dataset.initialContent;
    const currentTheme = appElement?.dataset.currentTheme;
    maxZoomLevel = Number(appElement?.dataset.maxZoom) || maxZoomLevel;
    maxTextSize = Number(appElement?.dataset.maxTextSize) || maxTextSize;
    maxEdges = Number(appElement?.dataset.maxEdges) || maxEdges;
    if (initialContent) {
      diagramContent = decodeURIComponent(initialContent);
      theme = currentTheme ? decodeURIComponent(currentTheme) : 'default';
      renderDiagram();
    } else {
      renderDiagram();
      updateZoomLevel();
    }
  });
</script>

<style>
  #mermaid-diagram {
    height: 100vh;
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  :global(#mermaid-diagram.pan-enabled) {
    cursor: grab;
  }
  
  :global(#mermaid-diagram.pan-enabled:active) {
    cursor: grabbing;
  }
  #app-container {
    flex-direction: column;
    width: 100%;
    height: 100vh;
    gap: 10px;
  }
  .sidebar-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
</style>


<div id="app-container" style="background: {theme?.includes('dark') ? '#1e1e1e' : 'white'}">
  <ErrorMessage {errorMessage} />
  <div id="mermaid-diagram"></div>
  <div class="sidebar-container">
    {#if !errorMessage}
    <LeftSideBar {iconBackgroundColor} {sidebarBackgroundColor} {shadowColor} {svgColor} {theme}/>
    <Sidebar {panEnabled} {iconBackgroundColor} {sidebarBackgroundColor} {shadowColor} {svgColor} {zoomLevel} {togglePan} {zoomOut} {resetView} {zoomIn} />
  {/if}
  </div>

</div>
