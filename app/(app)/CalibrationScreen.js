import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { doc, setDoc, collection } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import Svg, { Path, Circle, G, Line } from 'react-native-svg';

export default function CalibrationScreen() {
  const router = useRouter();
  const [calibrationStep, setCalibrationStep] = useState(0); // 0: intro, 1: calibrating, 2: complete
  const [readings, setReadings] = useState([]);
  const [progress, setProgress] = useState(0);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [error, setError] = useState(null);
  
  const API_URL = "http://192.168.23.224:5000/data";
  const TOTAL_READINGS = 20;
  
  // Function to fetch sensor data from API
  const fetchSensorData = async () => {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error("Failed to fetch sensor data");
      const data = await response.json();
      return data;
    } catch (err) {
      console.error("Error fetching sensor data:", err);
      setError(err.message);
      return null;
    }
  };

  // Handle the calibration process
  const startCalibration = async () => {
    setIsCalibrating(true);
    setCalibrationStep(1);
    setReadings([]);
    setProgress(0);
    setError(null);
    
    let collectedReadings = [];
    
    // Collect readings
    for (let i = 0; i < TOTAL_READINGS; i++) {
      const sensorData = await fetchSensorData();
      
      if (sensorData) {
        collectedReadings.push(sensorData);
        setProgress((i + 1) / TOTAL_READINGS);
      } else {
        // If we can't get sensor data, retry this reading
        i--;
        // But don't retry more than 3 times in a row
        if (i < -3) {
          setError("Unable to connect to the sensor. Please check your connection and try again.");
          setIsCalibrating(false);
          return;
        }
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Add a small delay between readings
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setReadings(collectedReadings);
    
    // Calculate min/max values for each sensor
    const calibrationData = calculateCalibrationData(collectedReadings);
    
    // Save to Firebase
    await saveCalibrationData(collectedReadings, calibrationData);
    
    setIsCalibrating(false);
    setCalibrationStep(2);
  };
  
  // Calculate min/max values for each sensor from the readings
  const calculateCalibrationData = (readings) => {
    const keys = ["yaw1", "pitch1", "roll1", "yaw2", "pitch2", "roll2", "flex_angle1"];
    let calibrationData = {};
    
    keys.forEach(key => {
      const values = readings.map(reading => Number(reading[key]));
      calibrationData[key] = {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((sum, val) => sum + val, 0) / values.length
      };
    });
    
    return calibrationData;
  };
  
  // Save calibration data to Firebase
  const saveCalibrationData = async (readings, calibrationData) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.log("No user logged in");
        return;
      }
      
      // Save all individual readings
      for (let i = 0; i < readings.length; i++) {
        const readingRef = doc(collection(db, "users", user.uid, "calibration_readings"));
        await setDoc(readingRef, {
          ...readings[i],
          timestamp: new Date(),
          index: i
        });
      }
      
      // Save the calibration data summary
      const calibrationRef = doc(db, "users", user.uid, "calibration_data", "baseline");
      await setDoc(calibrationRef, {
        ...calibrationData,
        timestamp: new Date(),
        readingsCount: readings.length
      });
      
      console.log("Calibration data saved successfully");
    } catch (error) {
      console.error("Error saving calibration data:", error);
      setError("Failed to save calibration data. You can try again later from settings.");
    }
  };
  
  const handleComplete = () => {
    router.push('/signin');
  };
  
  const GoodPostureAvatar = () => (
    <Svg width="150" height="200" viewBox="0 0 200 300">
      <Circle cx="100" cy="45" r="25" fill="#F5DEB3" stroke="#333" strokeWidth="1.5" />
      <Circle cx="90" cy="40" r="3" fill="#333" />
      <Circle cx="110" cy="40" r="3" fill="#333" />
      <Path d="M92 55 Q100 60 108 55" stroke="#333" strokeWidth="1.5" fill="none" />
      <Line x1="100" y1="70" x2="100" y2="85" stroke="#333" strokeWidth="8" strokeLinecap="round" />
      <Path d="M70 90 L70 180 C85 195 115 195 130 180 L130 90 C115 100 85 100 70 90 Z" fill="#F5DEB3" stroke="#333" strokeWidth="1.5" />
      <Path d="M100 85 L100 180" stroke="#4CAF50" strokeWidth="5" strokeLinecap="round" strokeDasharray="5,3" />
      <Path d="M70 100 L40 130" stroke="#333" strokeWidth="8" strokeLinecap="round" />
      <Path d="M130 100 L160 130" stroke="#333" strokeWidth="8" strokeLinecap="round" />
      <Path d="M70 95 Q100 80 130 95" stroke="#333" strokeWidth="2" fill="none" />
      <Path d="M85 180 L75 260" stroke="#333" strokeWidth="10" strokeLinecap="round" />
      <Path d="M115 180 L125 260" stroke="#333" strokeWidth="10" strokeLinecap="round" />
    </Svg>
  );
  

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {calibrationStep === 0 && (
        <View style={styles.introContainer}>
          <Text style={styles.headerText}>Posture Calibration</Text>
          
          <View style={styles.avatarContainer}>
            <GoodPostureAvatar />
          </View>
          
          <Text style={styles.instructionText}>
            Let's calibrate your posture sensor! This will help us better detect when your posture needs improvement.
          </Text>
          
          <Text style={styles.stepText}>
            1. Find a comfortable chair
          </Text>
          <Text style={styles.stepText}>
            2. Sit with your back straight and shoulders relaxed
          </Text>
          <Text style={styles.stepText}>
            3. Look forward with your head level
          </Text>
          <Text style={styles.stepText}>
            4. Stay still during the calibration process
          </Text>
          
          <TouchableOpacity style={styles.button} onPress={startCalibration}>
            <Text style={styles.buttonText}>Start Calibration</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {calibrationStep === 1 && (
        <View style={styles.calibratingContainer}>
          <Text style={styles.headerText}>Calibrating...</Text>
          
          <View style={styles.avatarContainer}>
            <GoodPostureAvatar />
          </View>
          
          <Text style={styles.instructionText}>
            Maintain your good posture while we take some measurements.
          </Text>
          
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
          </View>
          
          <Text style={styles.progressText}>
            {Math.round(progress * TOTAL_READINGS)} / {TOTAL_READINGS} readings
          </Text>
          
          {error && (
            <Text style={styles.errorText}>Error: {error}</Text>
          )}
        </View>
      )}
      
      {calibrationStep === 2 && (
        <View style={styles.completedContainer}>
          <Text style={styles.headerText}>Calibration Complete!</Text>
          
          <View style={styles.successIconContainer}>
            <Svg width="100" height="100" viewBox="0 0 100 100">
              <Circle cx="50" cy="50" r="45" fill="#e6ffe6" stroke="#4CAF50" strokeWidth="5" />
              <Path d="M30 50 L45 65 L70 35" stroke="#4CAF50" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          
          <Text style={styles.successText}>
            Your posture baseline has been saved successfully!
          </Text>
          
          <Text style={styles.detailText}>
            We've captured {readings.length} readings to help personalize your posture detection.
          </Text>
          
          <TouchableOpacity style={styles.button} onPress={handleComplete}>
            <Text style={styles.buttonText}>Continue to Sign In</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: wp(5),
    paddingTop: hp(8)
  },
  introContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: hp(2)
  },
  calibratingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: hp(2)
  },
  completedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: hp(2)
  },
  headerText: {
    fontSize: hp(4),
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: hp(2)
  },
  avatarContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    marginBottom: hp(2)
  },
  instructionText: {
    fontSize: hp(2.2),
    textAlign: 'center',
    color: '#333',
    marginBottom: hp(2),
    paddingHorizontal: wp(5)
  },
  stepText: {
    fontSize: hp(2),
    color: '#444',
    marginBottom: hp(0.5)
  },
  button: {
    backgroundColor: '#4f46e5',
    paddingVertical: hp(2),
    paddingHorizontal: wp(10),
    borderRadius: 15,
    marginTop: hp(3)
  },
  buttonText: {
    color: 'white',
    fontSize: hp(2.2),
    fontWeight: 'bold'
  },
  progressBarContainer: {
    width: '80%',
    height: hp(1.5),
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: hp(2)
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4CAF50'
  },
  progressText: {
    fontSize: hp(2),
    color: '#555',
    marginTop: hp(1)
  },
  errorText: {
    color: '#F44336',
    fontSize: hp(1.8),
    textAlign: 'center',
    marginTop: hp(2)
  },
  successIconContainer: {
    marginBottom: hp(3)
  },
  successText: {
    fontSize: hp(2.5),
    color: '#4CAF50',
    fontWeight: 'bold',
    textAlign: 'center'
  },
  detailText: {
    fontSize: hp(2),
    color: '#555',
    textAlign: 'center',
    paddingHorizontal: wp(10)
  }
});