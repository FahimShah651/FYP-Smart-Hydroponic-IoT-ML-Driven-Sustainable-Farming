/**
 * HydroponicDashboard - A namespace to encapsulate all dashboard functionality
 * This avoids conflicts with global variables defined in Code.gs
 */
const HydroponicDashboard = (function() {
  // Parameter definitions for the dashboard
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
  
  // Internal helper function to map dashboard parameters to sheet headers
  function _getHeaderIndices() {
    // Create mapping from dashboard parameter IDs to header indices
    const headerMap = {
      timestamp: 1, // ESP_Timestamp index
      temperature: HEADERS.indexOf("Temperature"),
      humidity: HEADERS.indexOf("Humidity"),
      nitrogen: HEADERS.indexOf("Nitrogen"),
      phosphorus: HEADERS.indexOf("Phosphorus"),
      potassium: HEADERS.indexOf("Potassium"),
      waterLevel: HEADERS.indexOf("WaterLevel"),
      tds: HEADERS.indexOf("TDS"),
      ph: HEADERS.indexOf("pH"),
      ec: HEADERS.indexOf("EC")
    };
    
    // Ensure all indices are valid
    for (const [param, index] of Object.entries(headerMap)) {
      if (index === -1 && param !== 'timestamp') {
        Logger.log(`Warning: Could not find header for ${param}`);
      }
    }
    
    return headerMap;
  }
  
  /**
   * Sample data points to reduce the number of points while preserving the shape of the data
   * @param {Array} data - Original data array
   * @param {number} targetCount - Target number of data points
   * @returns {Array} Sampled data points
   */
  function _sampleDataPoints(data, targetCount) {
    if (data.length <= targetCount) {
      return data;
    }
    
    const interval = Math.floor(data.length / targetCount);
    const sampled = [];
    
    for (let i = 0; i < data.length; i += interval) {
      sampled.push(data[i]);
      if (sampled.length >= targetCount) break;
    }
    
    // Always include the last data point
    if (sampled[sampled.length - 1] !== data[data.length - 1]) {
      sampled.push(data[data.length - 1]);
    }
    
    return sampled;
  }
  
  // Public API
  return {
    /**
     * Shows the dashboard in the sidebar
     */
    showDashboard: function() {
      const html = HtmlService.createHtmlOutputFromFile('google_sheet_dashboard')
        .setTitle('Smart Hydroponic Dashboard')
        .setWidth(600); // Max width allowed for sidebar
      SpreadsheetApp.getUi().showSidebar(html);
    },
    
    /**
     * Opens the dashboard in a new tab/window with larger size
     */
    showDashboardTab: function() {
      const html = HtmlService.createHtmlOutputFromFile('google_sheet_dashboard')
        .setSandboxMode(HtmlService.SandboxMode.IFRAME)
        .setWidth(1200) // Much wider for better visualization
        .setHeight(800); // Much taller for better visualization
      SpreadsheetApp.getUi().showModelessDialog(html, 'Smart Hydroponic Dashboard');
    },
    
    /**
     * Gets the web app URL for opening in a new browser tab
     * This creates a URL that can be opened directly in a browser
     */
    getWebAppUrl: function() {
      // Get the deployment URL
      const scriptUrl = ScriptApp.getService().getUrl();
      // Return the URL with parameters to indicate it's for the dashboard
      return scriptUrl + '?view=dashboard';
    },
    
    /**
     * Shows the dashboard in a dialog
     */
    showDashboardDialog: function() {
      const html = HtmlService.createHtmlOutputFromFile('google_sheet_dashboard')
        .setWidth(800)
        .setHeight(600);
      SpreadsheetApp.getUi().showModalDialog(html, 'Hydroponic Stats');
    },
    
    /**
     * Gets configuration for the dashboard UI
     */
    getDashboardConfig: function() {
      return {
        parameters: PARAMETERS,
        timeRanges: [
          { id: '60', name: '1 Hour' },
          { id: '360', name: '6 Hours' },
          { id: '720', name: '12 Hours' },
          { id: '1440', name: '1 Day' },
          { id: '10080', name: '1 Week' },
          { id: '43200', name: '30 Days' },
          { id: '0', name: 'All Data' }
        ]
      };
    },
    
    /**
     * Gets all chart data for the dashboard
     * @param {number} timeRange - Time range in minutes (0 for all data)
     * @returns {Array} Array of data points with all parameters
     */
    getChartData: function(timeRange) {
      const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
      
      // Calculate start time for filtering
      let startTime = null;
      if (timeRange > 0) {
        startTime = new Date();
        startTime.setMinutes(startTime.getMinutes() - timeRange);
      }
      
      // Get header indices mapping
      const headerIndices = _getHeaderIndices();
      
      // Helper function to process data from a sheet
      function processSheetData(sheetName) {
        try {
          const sheet = spreadsheet.getSheetByName(sheetName);
          if (!sheet) {
            Logger.log(`Sheet ${sheetName} not found`);
            return [];
          }
          
          // Skip if sheet is empty or only has headers
          if (sheet.getLastRow() <= 1) {
            Logger.log(`Sheet ${sheetName} is empty or only has headers`);
            return [];
          }
          
          // Get all data from the sheet (excluding headers)
          const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
          const data = dataRange.getValues();
          
          Logger.log(`Processing ${data.length} rows from ${sheetName}`);
          
          // Process each row
          const sheetData = [];
          data.forEach(row => {
            try {
              // Get timestamp from the LoggedAt column (0) or ESP_Timestamp column (1)
              const timestamp = new Date(row[0]) || new Date(row[1]);
              
              // Skip if outside time range
              if (startTime && timestamp < startTime) {
                return;
              }
              
              // Create data point with all parameters
              const dataPoint = {
                timestamp: timestamp.getTime(),
                temperature: parseFloat(row[headerIndices.temperature]) || null,
                humidity: parseFloat(row[headerIndices.humidity]) || null,
                nitrogen: parseFloat(row[headerIndices.nitrogen]) || null,
                phosphorus: parseFloat(row[headerIndices.phosphorus]) || null,
                potassium: parseFloat(row[headerIndices.potassium]) || null,
                waterLevel: parseFloat(row[headerIndices.waterLevel]) || null,
                tds: parseFloat(row[headerIndices.tds]) || null,
                ph: parseFloat(row[headerIndices.ph]) || null,
                ec: parseFloat(row[headerIndices.ec]) || null
              };
              
              sheetData.push(dataPoint);
            } catch (e) {
              // Skip invalid rows
              Logger.log('Error processing row: ' + e.toString());
            }
          });
          
          return sheetData;
        } catch (e) {
          Logger.log(`Error processing sheet ${sheetName}: ${e.toString()}`);
          return [];
        }
      }
      
      // Get data from both sheets
      const sheet1Data = processSheetData(MAIN_DATA_SHEET);
      const sheet3Data = processSheetData(ARCHIVE_SHEET_NAME);
      
      Logger.log(`Found ${sheet1Data.length} records in ${MAIN_DATA_SHEET} and ${sheet3Data.length} records in ${ARCHIVE_SHEET_NAME}`);
      
      // Combine data from both sheets
      const combinedData = [...sheet3Data, ...sheet1Data];
      
      // Sort by timestamp to ensure chronological order
      combinedData.sort((a, b) => a.timestamp - b.timestamp);
      
      Logger.log(`Combined data has ${combinedData.length} records`);
      
      // If we have more than 1000 points, sample them to improve performance
      if (combinedData.length > 1000) {
        return _sampleDataPoints(combinedData, 1000);
      }
      
      return combinedData;
    }
  };
})();

// The onOpen function is now centralized in Code.gs

// Web app entry point - check for dashboard view parameter
function doGet(e) {
  // Check if the main Code.gs already has a doGet function
  // If it does, defer to it unless the view=dashboard parameter is present
  if (e && e.parameter && e.parameter.view === 'dashboard') {
    // This is a request for the dashboard view
    return HtmlService.createHtmlOutputFromFile('google_sheet_dashboard')
      .setTitle('Smart Hydroponic System Dashboard')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  } else if (typeof this.mainDoGet === 'function') {
    // If there's a mainDoGet function (renamed from the original Code.gs), call it
    return this.mainDoGet(e);
  } else {
    // Default response if no specific handler
    return ContentService.createTextOutput('Smart Hydroponic System API')
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

// Global functions that serve as entry points to the dashboard
function showDashboardSidebar() {
  HydroponicDashboard.showDashboard();
}

function showDashboardTab() {
  HydroponicDashboard.showDashboardTab();
}

function openDashboardInBrowserTab() {
  try {
    // Get the web app URL
    const url = HydroponicDashboard.getWebAppUrl();
    
    // Check if the script has been deployed
    if (!url || url === '') {
      // Script not deployed, show deployment instructions
      const deployInstructions = HtmlService.createHtmlOutput(
        `<div style="font-family: Arial, sans-serif; padding: 20px;">
           <h3>The dashboard is not yet available as a web app</h3>
           <p>To open the dashboard in a browser tab, you need to deploy this script as a web app first:</p>
           <ol>
             <li>In the Apps Script editor, go to <strong>Deploy → New deployment</strong></li>
             <li>Select type: <strong>Web app</strong></li>
             <li>Enter description: "Hydroponic Dashboard"</li>
             <li>Execute as: <strong>Me</strong> (your Google account)</li>
             <li>Who has access: <strong>Anyone with Google account</strong> (or Anyone)</li>
             <li>Click <strong>Deploy</strong> and authorize when prompted</li>
             <li>Copy the web app URL for future use</li>
           </ol>
           <p>After deployment, try this option again to open the dashboard in a new browser tab.</p>
         </div>`
      )
      .setWidth(500)
      .setHeight(400);
      
      SpreadsheetApp.getUi().showModalDialog(deployInstructions, 'Dashboard Web App Not Deployed');
      return;
    }
    
    // URL is available, show dialog with link to open in new tab
    const html = HtmlService.createHtmlOutput(
      `<div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
         <h3>Open Dashboard in New Browser Tab</h3>
         <p>Click the button below to open the dashboard in a new browser tab:</p>
         <p><a href="${url}?view=dashboard" target="_blank" 
               style="display: inline-block; background-color: #4285F4; color: white; 
                      padding: 10px 20px; text-decoration: none; border-radius: 4px; 
                      font-weight: bold; margin: 15px 0;">
            Open Hydroponic Dashboard
         </a></p>
         <p style="color: #666; font-size: 12px;">(You may need to allow pop-ups for automatic opening to work)</p>
         <hr>
         <p style="color: #666; font-size: 12px;">If you see an error about access or permissions, make sure you're logged into the correct Google account.</p>
         <script>window.open('${url}?view=dashboard', '_blank');</script>
       </div>`
    )
    .setWidth(450)
    .setHeight(300);
    
    SpreadsheetApp.getUi().showModalDialog(html, 'Opening Dashboard in Browser Tab');
  } catch (e) {
    // Show error message
    SpreadsheetApp.getUi().alert('Error opening dashboard: ' + e.toString());
  }
}

function showDashboardDialog() {
  HydroponicDashboard.showDashboardDialog();
}

function getDashboardConfig() {
  return HydroponicDashboard.getDashboardConfig();
}

function getChartData(timeRange) {
  return HydroponicDashboard.getChartData(timeRange);
}

