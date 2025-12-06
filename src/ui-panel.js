/**
 * Panel UI Management - Drag, Minimize
 */

let isDragging = false;
let startX = 0;
let startY = 0;
let startPanelX = 0;
let startPanelY = 0;

export function initPanelControls() {
  const uiPanel = document.getElementById('uiPanel');
  const panelHeader = document.getElementById('panelHeader');
  const minimizeBtn = document.getElementById('minimizeBtn');

  if (!uiPanel || !panelHeader) {
    console.warn('Panel elements not found');
    return;
  }

  // ============ DRAG FUNCTIONALITY ============
  panelHeader.addEventListener('mousedown', (e) => {
    // Jangan drag jika click di button
    if (e.target.classList.contains('panel-btn')) return;

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startPanelX = uiPanel.offsetLeft;
    startPanelY = uiPanel.offsetTop;

    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', stopDrag);
  });

  function handleDrag(e) {
    if (!isDragging) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    uiPanel.style.left = (startPanelX + deltaX) + 'px';
    uiPanel.style.top = (startPanelY + deltaY) + 'px';
    uiPanel.style.right = 'auto';
  }

  function stopDrag() {
    isDragging = false;
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', stopDrag);
  }

  // ============ MINIMIZE FUNCTIONALITY ============
  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', () => {
      uiPanel.classList.toggle('minimized');
      
      if (uiPanel.classList.contains('minimized')) {
        minimizeBtn.textContent = '+';
        minimizeBtn.title = 'Maximize';
      } else {
        minimizeBtn.textContent = '−';
        minimizeBtn.title = 'Minimize';
      }
    });
  }

  // ============ PREVENT TEXT SELECTION WHILE DRAGGING ============
  panelHeader.addEventListener('selectstart', (e) => {
    if (isDragging) e.preventDefault();
  });
}
