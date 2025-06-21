/**
 * Google Sheets Integration for Smart Hydroponic System
 * This script fetches real data from Google Sheets and displays it using Google Charts
 */

// Google Apps Script Web App URL - Replace with your deployed web app URL
const GOOGLE_SCRIPT_URL = 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL';

// Store chart data
let googleChartData = null;
let chart = null;

// Parameter configurations
const PARAMETERS = [
  { id: 'temperature', name: 'Air Temperature', color: '#FF5733', unit: '°C' },
  { id: 'humidity', name: 'Air Humidity', color: '#33A2FF', unit: '%' },
  { id: 'nitrogen', name: 'Nitrogen', color: '#33FF57', unit: '' },
  { id: 'phosphorus', name: 'Phosphorus', color: '#F033FF', unit: '' },
  { id: 'potassium', name: 'Potassium', color: '#FF9F33', unit: '' },
  { id: 'waterLevel', name: 'Water Level', color: '#33FFF0', unit: '%' },
  { id: 'tds', name: 'TDS', color: '#8C33FF', unit: 'ppm' },
  { id: 'ph', name: 'pH', color: '#FF336E', unit: '' },
  { id: 'ec', name: 'EC', color: '#33FFBD', unit: 'mS/cm' }
];

// Initialize the dashboard when the page loads
document.addEventListener('DOMContentLoaded', function() {
  console.log('Initializing Google Sheets Dashboard');
  
  // Load Google Charts
  google.charts.load('current', {'packages':['corechart']});
  google.charts.setOnLoadCallback(initDashboard);
  
  // Set up event listeners
  setupEventListeners();
});

/**
 * Initialize the dashboard components
 */
function initDashboard() {
  // Fetch data from Google Sheets
  fetchGoogleSheetsData();
  
  // Set up parameter checkboxes
  setupParameterCheckboxes();
  
  // Set default time range
  const timeRangeSelect = document.getElementById('time-range');
  if (timeRangeSelect) {
    timeRangeSelect.value = '24'; // Default to 24 hours
  }
}

/**
 * Set up event listeners for dashboard controls
 */
function setupEventListeners() {
  // Time range change
  const timeRangeSelect = document.getElementById('time-range');
  if (timeRangeSelect) {
    timeRangeSelect.addEventListener('change', function() {
      if (googleChartData) {
        drawChart(googleChartData);
      }
    });
  }
  
  // Refresh button
  const refreshButton = document.getElementById('refresh-btn');
  if (refreshButton) {
    refreshButton.addEventListener('click', function() {
      fetchGoogleSheetsData();
    });
  }
  
  // Export button
  const exportButton = document.getElementById('export-btn');
  if (exportButton) {
    exportButton.addEventListener('click', function() {
      exportChartAsPng();
    });
  }
}

/**
 * Set up parameter checkboxes for data selection
 */
function setupParameterCheckboxes() {
  const container = document.getElementById('parameter-list');
  if (!container) {
    console.error('Parameter list container not found');
    return;
  }
  
  // Clear existing checkboxes
  container.innerHTML = '';
  
  PARAMETERS.forEach(param => {
    const checkboxId = `checkbox-${param.id}`;
    
    // Create checkbox element if it doesn't exist
    if (!document.getElementById(checkboxId)) {
      const label = document.createElement('label');
      label.className = 'parameter-item';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'parameter-checkbox';
      checkbox.id = checkboxId;
      checkbox.value = param.id;
      
      // Default selections
      checkbox.checked = ['temperature', 'humidity'].includes(param.id);
      
      // Color indicator
      const colorIndicator = document.createElement('span');
      colorIndicator.className = 'color-indicator';
      colorIndicator.style.backgroundColor = param.color;
      
      // Parameter name
      const nameSpan = document.createElement('span');
      nameSpan.textContent = param.name;
      
      // Add event listener
      checkbox.addEventListener('change', function() {
        if (googleChartData) {
          drawChart(googleChartData);
        }
      });
      
      // Assemble checkbox group
      label.appendChild(checkbox);
      label.appendChild(colorIndicator);
      label.appendChild(nameSpan);
      
      container.appendChild(label);
    }
  });
}

/**
 * Fetch data from Google Sheets
 */
function fetchGoogleSheetsData() {
  // Show loading indicator
  const chartContainer = document.getElementById('chart_div');
  if (chartContainer) {
    chartContainer.innerHTML = '<div class="loading-container"><div class="spinner"></div><p>Loading data from Google Sheets...</p></div>';
  }
  
  // Clear data table
  const tableBody = document.getElementById('table-body');
  if (tableBody) {
    tableBody.innerHTML = '<tr><td colspan="10" class="text-center"><div class="spinner-border spinner-border-sm me-2"></div>Loading data...</td></tr>';
  }
  
  console.log('Fetching data from Google Sheets API...');
  
  // Fetch data from Google Sheets API
  fetch(`${GOOGLE_SCRIPT_URL}?action=getChartData`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      console.log('Response received from Google Sheets API');
      return response.json();
    })
    .then(data => {
      console.log(`Received ${data.length} data points from Google Sheets`);
      
      // Check if data is empty
      if (!data || data.length === 0) {
        showError("No data available in Google Sheets");
        clearDataTable("No data available");
        return;
      }
      
      // Log first item to check structure
      console.log('First data point:', data[0]);
      
      // Store the data
      googleChartData = data;
      
      // Update last updated time
      updateLastUpdated();
      
      // Update stats cards
      updateStats(data);
      
      // Draw the chart
      drawChart(data);
      
      // Update the data table
      updateDataTable(data);
    })
    .catch(error => {
      console.error('Error fetching data from Google Sheets:', error);
      showError(`Failed to load data from Google Sheets: ${error.message}`);
      clearDataTable(`Error: ${error.message}`);
    });
}

/**
 * Update the "Last Updated" timestamp
 */
function updateLastUpdated() {
  const lastUpdatedElement = document.getElementById('last-updated');
  if (lastUpdatedElement) {
    const now = new Date();
    lastUpdatedElement.textContent = now.toLocaleString();
  }
}

/**
 * Update dashboard stats with the latest data
 */
function updateStats(data) {
  if (!data || data.length === 0) return;
  
  // Get the most recent data point
  const latestData = data[data.length - 1];
  
  // Update each stat card
  PARAMETERS.forEach(param => {
    const valueElement = document.getElementById(`${param.id}-value`);
    if (valueElement && latestData[param.id] !== undefined) {
      valueElement.textContent = typeof latestData[param.id] === 'number' 
        ? latestData[param.id].toFixed(1) 
        : latestData[param.id];
    }
  });
}

/**
 * Sample data to improve chart performance
 */
function sampleData(data, maxPoints = 500) {
  if (!data || data.length === 0) return [];
  
  // If data is small enough, return all points
  if (data.length <= maxPoints) {
    return data;
  }
  
  // Calculate sampling interval
  const interval = Math.max(1, Math.floor(data.length / maxPoints));
  
  // Simple sampling - take every nth item
  return data.filter((_, index) => index % interval === 0 || index === data.length - 1);
}

/**
 * Draw the Google Chart with the data
 */
function drawChart(data) {
  if (!data || data.length === 0) {
    showError("No data available to display");
    return;
  }

  // Get the selected time range from the dropdown
  const timeRangeSelect = document.getElementById('time-range');
  const timeRangeHours = timeRangeSelect ? parseInt(timeRangeSelect.value) : 0;
  
  // Filter data by time range
  let filteredData = data;
  if (timeRangeHours > 0) {
    console.log(`Filtering data to last ${timeRangeHours} hours`);
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - timeRangeHours);
    
    filteredData = data.filter(item => {
      // Parse the timestamp as a number (milliseconds since epoch)
      let timestamp;
      try {
        // Get the ESP_Timestamp field which is now in milliseconds
        if (typeof item.timestamp === 'number') {
          timestamp = new Date(item.timestamp);
        } else if (typeof item.timestamp === 'string' && !isNaN(parseInt(item.timestamp))) {
          timestamp = new Date(parseInt(item.timestamp));
        } else {
          // As a fallback, try other timestamp fields
          if (item.ESP_Timestamp) {
            timestamp = new Date(parseInt(item.ESP_Timestamp));
          } else {
            console.warn('No valid timestamp found in data point:', item);
            return true; // Include by default
          }
        }
        return timestamp >= cutoffTime;
      } catch (e) {
        console.error('Error filtering by time:', e);
        return true; // Include by default if parsing fails
      }
    });
    
    if (filteredData.length === 0) {
      showError(`No data available for the selected time range (last ${timeRangeHours} hours)`);
      return;
    }
  }
  
  console.log(`Drawing chart with ${filteredData.length} data points (time range: ${timeRangeHours} hours)`);
  
  // Sample data if there are too many points
  const sampledData = sampleData(filteredData, 500);
  console.log(`Sampled to ${sampledData.length} data points (${Math.round(sampledData.length/filteredData.length*100)}% of original)`);
  
  // Create data table
  const dataTable = new google.visualization.DataTable();
  dataTable.addColumn('datetime', 'Time');
  
  // Get selected parameters from checkboxes
  const paramSelections = {};
  document.querySelectorAll('.parameter-checkbox').forEach(checkbox => {
    paramSelections[checkbox.value] = checkbox.checked;
  });
  
  // Default to showing temperature and humidity if nothing selected
  if (Object.keys(paramSelections).filter(key => paramSelections[key]).length === 0) {
    paramSelections.temperature = true;
    paramSelections.humidity = true;
  }
  
  // Add columns for selected parameters
  const activeParams = PARAMETERS.filter(param => paramSelections[param.id]);
  activeParams.forEach(param => {
    dataTable.addColumn('number', `${param.name} ${param.unit ? '(' + param.unit + ')' : ''}`);
  });
  
  // Process timestamps and create rows for the chart
  const rows = sampledData.map(item => {
    // Parse timestamp (milliseconds since epoch from Google Sheets API)
    let timestamp;
    try {
      // First try ESP_Timestamp which is now the primary timestamp field in milliseconds
      if (item.ESP_Timestamp !== undefined && item.ESP_Timestamp !== null) {
        // ESP_Timestamp should be milliseconds since epoch
        const millisValue = typeof item.ESP_Timestamp === 'string' ? 
          parseInt(item.ESP_Timestamp) : item.ESP_Timestamp;
        
        if (!isNaN(millisValue)) {
          timestamp = new Date(millisValue);
          console.log(`Parsed ESP_Timestamp ${millisValue} to ${timestamp.toISOString()}`);
        }
      }
      
      // Fallback to regular timestamp field if ESP_Timestamp failed
      if (!timestamp && item.timestamp !== undefined && item.timestamp !== null) {
        if (typeof item.timestamp === 'number') {
          timestamp = new Date(item.timestamp);
        } else if (typeof item.timestamp === 'string' && !isNaN(parseInt(item.timestamp))) {
          timestamp = new Date(parseInt(item.timestamp));
        }
      }
      
      // Final fallback
      if (!timestamp || isNaN(timestamp.getTime())) {
        console.warn('Could not parse any timestamp from data point:', item);
        timestamp = new Date(); // Fallback to current time
      }
    } catch (e) {
      console.error('Error parsing timestamp:', e);
      timestamp = new Date(); // Fallback to current time
    }
    
    // Create row with timestamp and sensor values
    const row = [timestamp];
    activeParams.forEach(param => {
      const value = item[param.id];
      row.push(value !== undefined && value !== null ? parseFloat(value) : null);
    });
    return row;
  });
  
  // Add rows to the data table
  dataTable.addRows(rows);
  
  // Chart options
  const options = {
    title: `Sensor Readings Over Time (Showing ${Math.round(sampledData.length/data.length*100)}% of ${data.length} data points)`,
    height: 400,
    chartArea: { width: '85%', height: '70%' },
    legend: { position: 'bottom' },
    hAxis: {
      title: 'Time',
      format: 'MMM d, HH:mm',
      gridlines: { count: 8 },
      slantedText: true,
      slantedTextAngle: 30,
      textStyle: { fontSize: 10 }
    },
    vAxis: {
      title: 'Value',
      viewWindow: { min: 0 },
      gridlines: { count: 8 }
    },
    colors: activeParams.map(param => param.color),
    pointSize: sampledData.length < 100 ? 4 : 2, // Larger points for smaller datasets
    lineWidth: 2,
    curveType: 'function',
    explorer: {
      actions: ['dragToZoom', 'rightClickToReset'],
      axis: 'horizontal',
      keepInBounds: true
    }
  };
  
  // Draw the chart
  chart = new google.visualization.LineChart(document.getElementById('chart_div'));
  chart.draw(dataTable, options);
}

/**
 * Show error message in the chart area
 */
function showError(message) {
  const chartDiv = document.getElementById('chart_div');
  if (chartDiv) {
    chartDiv.innerHTML = `
      <div class="error-container">
        <i class="fas fa-exclamation-triangle"></i>
        <p>${message}</p>
      </div>
    `;
  }
  console.error(message);
}

/**
 * Export the chart as PNG image
 */
function exportChartAsPng() {
  const chartDiv = document.getElementById('chart_div');
  if (!chartDiv || !chart) {
    console.error('Chart not available for export');
    return;
  }
  
  try {
    // Show export in progress
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
      const originalText = exportBtn.innerHTML;
      exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';
      
      // Use html2canvas to convert chart to image
      html2canvas(chartDiv).then(canvas => {
        // Create download link
        const link = document.createElement('a');
        link.download = `hydroponic-data-${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        // Reset button text
        setTimeout(() => {
          exportBtn.innerHTML = originalText;
        }, 1000);
      });
    }
  } catch (error) {
    console.error('Error exporting chart:', error);
    alert('Error exporting chart: ' + error.message);
  }
}

/**
 * Update the data table with the latest data
 * @param {Array} data - Array of data points
 */
function updateDataTable(data) {
  if (!data || data.length === 0) {
    clearDataTable('No data available');
    return;
  }
  
  const tableHeader = document.getElementById('table-header');
  const tableBody = document.getElementById('table-body');
  
  if (!tableHeader || !tableBody) {
    console.error('Table elements not found in DOM');
    return;
  }
  
  // Clear existing table header (except the first 'Time' column)
  while (tableHeader.children.length > 1) {
    tableHeader.removeChild(tableHeader.lastChild);
  }
  
  // Add column headers for each parameter
  const activeParams = PARAMETERS.filter(param => {
    const checkbox = document.querySelector(`.parameter-checkbox[value="${param.id}"]`);
    return checkbox && checkbox.checked;
  });
  
  // If no parameters are selected, show all parameters
  const paramsToShow = activeParams.length > 0 ? activeParams : PARAMETERS;
  
  // Add header columns
  paramsToShow.forEach(param => {
    const th = document.createElement('th');
    th.textContent = param.name;
    if (param.unit) th.textContent += ` (${param.unit})`;
    tableHeader.appendChild(th);
  });
  
  // Clear table body
  tableBody.innerHTML = '';
  
  // Get the latest 100 rows of data (or all if less than 100)
  const latestData = data.slice(-100).reverse(); // Reverse to show newest first
  
  // Create table rows
  latestData.forEach(item => {
    const row = document.createElement('tr');
    
    // Add timestamp cell
    const timeCell = document.createElement('td');
    let timestamp;
    try {
      if (typeof item.timestamp === 'number') {
        timestamp = new Date(item.timestamp);
      } else if (typeof item.timestamp === 'string' && !isNaN(parseInt(item.timestamp))) {
        timestamp = new Date(parseInt(item.timestamp));
      } else {
        console.warn('Unexpected timestamp format:', item.timestamp);
        timestamp = new Date(); // Fallback
      }
      timeCell.textContent = timestamp.toLocaleString();
    } catch (e) {
      console.error('Error formatting timestamp:', e);
      timeCell.textContent = 'Invalid date';
    }
    row.appendChild(timeCell);
    
    // Add cells for each parameter
    paramsToShow.forEach(param => {
      const cell = document.createElement('td');
      if (item[param.id] !== undefined && item[param.id] !== null) {
        const value = typeof item[param.id] === 'number' ? item[param.id].toFixed(2) : item[param.id];
        cell.textContent = value;
      } else {
        cell.textContent = '--';
      }
      row.appendChild(cell);
    });
    
    tableBody.appendChild(row);
  });
  
  console.log(`Updated data table with ${latestData.length} rows`);
}

/**
 * Clear the data table and show a message
 * @param {string} message - Message to display
 */
function clearDataTable(message) {
  const tableBody = document.getElementById('table-body');
  if (tableBody) {
    tableBody.innerHTML = `<tr><td colspan="10" class="text-center">${message}</td></tr>`;
  }
}