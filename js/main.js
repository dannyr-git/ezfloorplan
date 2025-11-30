// === Main Entry Point ============================================
// Initializes the application and wires up all modules

import { initDOM } from './dom.js';
import { resizeCanvas, draw } from './renderer-2d.js';
import { initCanvasEventHandlers, initKeyboardEventHandlers } from './interaction.js';
import { initUIEventHandlers } from './ui.js';

// Initialize application when DOM is ready
function init() {
  // Initialize DOM references first
  initDOM();
  
  // Set up event handlers
  initCanvasEventHandlers();
  initKeyboardEventHandlers();
  initUIEventHandlers();
  
  // Handle window resize
  window.addEventListener("resize", resizeCanvas);
  
  // Initial render
  resizeCanvas();
  draw();
}

// Start the application
init();
