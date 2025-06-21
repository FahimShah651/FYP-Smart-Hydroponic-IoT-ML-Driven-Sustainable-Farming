const express = require('express');
const router = express.Router();
const { getDatabase, ref, get, set, push } = require('firebase/database');

// Get all sensor data
router.get('/', async (req, res) => {
  try {
    const db = getDatabase();
    const snapshot = await get(ref(db, 'sensors'));
    
    if (snapshot.exists()) {
      res.json(snapshot.val());
    } else {
      res.status(404).json({ error: 'No sensor data found' });
    }
  } catch (error) {
    console.error('Error fetching sensor data:', error);
    res.status(500).json({ error: 'Failed to fetch sensor data' });
  }
});

// Get latest sensor reading
router.get('/latest', async (req, res) => {
  try {
    const db = getDatabase();
    const snapshot = await get(ref(db, 'sensors/latest'));
    
    if (snapshot.exists()) {
      res.json(snapshot.val());
    } else {
      res.status(404).json({ error: 'No sensor data found' });
    }
  } catch (error) {
    console.error('Error fetching latest sensor data:', error);
    res.status(500).json({ error: 'Failed to fetch latest sensor data' });
  }
});

// Add new sensor reading
router.post('/', async (req, res) => {
  try {
    const sensorData = req.body;
    const db = getDatabase();
    
    // Add timestamp
    sensorData.timestamp = Date.now();
    
    // Save to both latest and history
    await set(ref(db, 'sensors/latest'), sensorData);
    const newDataRef = push(ref(db, 'sensors/history'));
    await set(newDataRef, sensorData);
    
    res.status(201).json({ 
      message: 'Sensor data saved successfully',
      id: newDataRef.key 
    });
  } catch (error) {
    console.error('Error saving sensor data:', error);
    res.status(500).json({ error: 'Failed to save sensor data' });
  }
});

module.exports = router;
