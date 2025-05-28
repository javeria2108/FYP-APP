import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { collection, doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { Timestamp } from "firebase/firestore";
import Svg, { Path, Circle, G, Line, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import * as Speech from 'expo-speech';

export default function PostureStatusScreen() {
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState(null);
  const [postureBuffer, setPostureBuffer] = useState([]);
  const [lastReportedStatus, setLastReportedStatus] = useState(null);
  const [calibrationData, setCalibrationData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [postureIssueArea, setPostureIssueArea] = useState(null); // Track which area has issues
  const [sensorDeviations, setSensorDeviations] = useState(null); // Store calculated deviations
  
  // Animation value for smooth transitions between posture states
  const [postureAnimation] = useState(new Animated.Value(0));

  // References for tracking bad posture duration
  const badPostureStartTime = useRef(null);
  const alertTimeoutId = useRef(null);
  const lastAlertTime = useRef(0);
  const isAlertActive = useRef(false);
  // Refs for tracking cooldown
  const inCooldownPeriod = useRef(false);
  const cooldownEndTime = useRef(null);

  const API_URL = "http://192.168.23.224:5000/latest-prediction";
  const DATA_URL = "http://192.168.23.224:5000/data"; // Endpoint for raw sensor data
  const BUFFER_SIZE = 10; // Number of readings to collect before making a decision
  const THRESHOLD = 0.6; // 60% of readings must be bad posture to trigger an alert
  const BAD_POSTURE_ALERT_THRESHOLD = 30 * 1000; // 30 seconds for testing
  const ALERT_COOLDOWN = 10 * 60 * 1000; // 10 minutes cooldown between alerts

  const SENSOR_WEIGHTS = {
    yaw1: 0.15,     // Reduced weight for yaw (less accurate for posture) 
    pitch1: 0.8,    // Increased pitch importance for forward slouch
    roll1: 0.8,     // Increased roll importance for shoulder drop
    yaw2: 0.15,     // Reduced weight for yaw (less accurate for posture)
    pitch2: 0.8,    // Increased pitch importance for forward slouch
    roll2: 0.8,     // Increased roll importance for shoulder drop
    flex_angle1: 4.0  // Keep highest weight for flex sensor (as in original)
  };

  const SENSOR_GROUPS = {
    shoulders: ['yaw1', 'pitch1', 'roll1', 'yaw2', 'pitch2', 'roll2'],
    lower_back: ['flex_angle1']
  };

  
  // Fetch user's calibration data from Firebase
  const fetchCalibrationData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.log("No user logged in");
        return null;
      }

      const calibrationDocRef = doc(db, "users", user.uid, "calibration_data", "baseline");
      const docSnapshot = await getDoc(calibrationDocRef);

      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        console.log("Calibration data loaded:", data);
        return data;
      } else {
        console.log("No calibration data found for this user");
        return null;
      }
    } catch (error) {
      console.error("Error fetching calibration data:", error);
      return null;
    }
  };

 

  const determinePostureStatus = (modelPrediction, sensorData) => {
    // If we don't have calibration data, trust the model
    if (!calibrationData) return modelPrediction === 1 ? "Good Posture" : "Bad Posture";
    
    // Object to store whether each sensor is within its calibrated range
    const sensorsWithinRange = {};
    // Object to store percentage deviation for each sensor
    const deviationPercentages = {};
    
    // Define sensor-specific tolerance thresholds based on analyzed data
    const toleranceThresholds = {
      // Flex sensor appears to have tighter constraints for good posture
      'flex_angle1': 20,  // Allow 20% deviation for flex sensor
      // Angular sensors can have more variation
      'yaw1': 30,
      'pitch1': 30,
      'roll1': 35,  // Roll sensors have more variation in good posture samples
      'yaw2': 30,
      'pitch2': 30,
      'roll2': 35
    };
    
    // Check each sensor if it's within its calibrated range
    Object.keys(SENSOR_WEIGHTS).forEach(sensor => {
      if (sensorData[sensor] && calibrationData[sensor]) {
        // Get calibrated range with a minimum buffer to avoid too tight constraints
        let min = calibrationData[sensor].min;
        let max = calibrationData[sensor].max;
        console.log('calibrationDAta:',calibrationData)
        
        // Add a buffer to the calibration range to accommodate natural variations
        // Larger buffer for roll sensors which show more variability
        const bufferPercentage = sensor.includes('roll') ? 0.35 : 0.2;
        const rangeSize = Math.abs(max - min);
        const buffer = rangeSize * bufferPercentage;
        
        const effectiveMin = min - buffer;
        const effectiveMax = max + buffer;
        
        // Special case for flex_angle1 as it's more indicative of posture
        if (sensor === 'flex_angle1') {
          // From samples, bad posture typically has flex_angle1 > 35
          // Allow a more strict range for this critical sensor
          const isWithinRange = sensorData[sensor] >= effectiveMin && 
                                sensorData[sensor] <= Math.min(effectiveMax, 35);
          sensorsWithinRange[sensor] = isWithinRange;
        } else {
          // Check if reading is within range with buffer
          const isWithinRange = sensorData[sensor] >= effectiveMin && 
                                sensorData[sensor] <= effectiveMax;
          sensorsWithinRange[sensor] = isWithinRange;
        }
        
        // Calculate percentage deviation from closest boundary if outside range
        if (!sensorsWithinRange[sensor]) {
          const distanceFromMin = Math.abs(sensorData[sensor] - effectiveMin);
          const distanceFromMax = Math.abs(sensorData[sensor] - effectiveMax);
          const closestBoundary = Math.min(distanceFromMin, distanceFromMax);
          
          // Avoid division by zero with a minimum range size
          const effectiveRangeSize = Math.max(rangeSize, 0.001);
          
          // Calculate percentage deviation
          deviationPercentages[sensor] = (closestBoundary / effectiveRangeSize) * 100;
        } else {
          deviationPercentages[sensor] = 0; // No deviation if within range
        }
      }
    });
    
    console.log("Sensors within range:", sensorsWithinRange);
    console.log("Deviation percentages:", deviationPercentages);
    
    // Case 1: All sensors within range - definitely good posture
    const allSensorsWithinRange = Object.values(sensorsWithinRange).every(value => value === true);
    if (allSensorsWithinRange) {
      console.log("Case 1: All sensors within range - Good posture");
      return "Good Posture";
    }
    
    // Special case for flex_angle - critical for posture determination
    if (sensorData.flex_angle1 > 35) {
      console.log("Critical sensor flex_angle1 indicates poor posture");
      return "Bad Posture";
    }
    
    // Count how many sensors are within tolerance
    let sensorsWithinTolerance = 0;
    let totalSensors = 0;
    
    Object.keys(SENSOR_WEIGHTS).forEach(sensor => {
      if (sensorData[sensor] && calibrationData[sensor]) {
        totalSensors++;
        
        if (sensorsWithinRange[sensor] || 
            (deviationPercentages[sensor] && 
             deviationPercentages[sensor] <= toleranceThresholds[sensor])) {
          sensorsWithinTolerance++;
        }
      }
    });
    
    // Calculate percentage of sensors that are within tolerance
    const percentageWithinTolerance = (sensorsWithinTolerance / totalSensors) * 100;
    
    // Require at least 70% of sensors to be within tolerance for good posture
    if (percentageWithinTolerance >= 70) {
      console.log(`Case 2: ${percentageWithinTolerance.toFixed(1)}% of sensors within tolerance - Good posture`);
      return "Good Posture";
    }
    
    // If we get here, posture is likely bad
    console.log(`Case 3: Only ${percentageWithinTolerance.toFixed(1)}% of sensors within tolerance - Bad posture`);
    
    return "Bad Posture";
  };
  const fetchSensorData = async () => {
    try {
      const response = await fetch(DATA_URL);
      if (!response.ok) throw new Error("Failed to fetch sensor data");
      return await response.json();
    } catch (err) {
      console.error("Error fetching sensor data:", err);
      setError("Failed to get sensor readings");
      return null;
    }
  };

  const fetchPrediction = async () => {
    try {
      // First fetch raw sensor data
      const sensorData = await fetchSensorData();
      if (!sensorData) return;

      // Then fetch the model prediction
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error("Failed to fetch prediction");
      const data = await response.json();

      // Get the model's prediction
      const modelStatus = data.status === 1 ? "Good Posture" : "Bad Posture";
      
      // Personalize the posture status using calibration data and weighted deviations
      const personalizedStatus = determinePostureStatus(data.status, sensorData);
      
      console.log(`Model: ${modelStatus}, Personalized: ${personalizedStatus}`);
      
      // Update the UI with the personalized reading
      setPrediction({
        status: data.confidence < 0.6 ? personalizedStatus : modelStatus,
        confidence: (parseFloat(data.confidence) * 100).toFixed(2) + "%",
        modelStatus: modelStatus // Keep track of original model prediction
      });
      
      // Animate the avatar when status changes
      Animated.timing(postureAnimation, {
        toValue: personalizedStatus === "Good Posture" ? 0 : 1,
        duration: 800,
        useNativeDriver: false
      }).start();
      
      // Add to buffer
      updatePostureBuffer(personalizedStatus);
      
      // Handle bad posture duration tracking
      handlePostureDuration(personalizedStatus);
      
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  // Track bad posture duration and trigger alerts
  const handlePostureDuration = (currentStatus) => {
    const now = Date.now();
    
    // If in cooldown period, check if it's expired
    if (inCooldownPeriod.current && now >= cooldownEndTime.current) {
      console.log("Cooldown period expired");
      inCooldownPeriod.current = false;
      cooldownEndTime.current = null;
    }
    
    if (currentStatus === "Bad Posture") {
      // Don't start tracking if we're in cooldown period
      if (inCooldownPeriod.current) {
        console.log("In cooldown period, not starting bad posture tracking");
        return;
      }
      
      // Start tracking bad posture time if not already tracking
      if (badPostureStartTime.current === null) {
        console.log("Starting bad posture tracking");
        badPostureStartTime.current = now;
        
        // Set timeout for alert after threshold of continuous bad posture
        if (alertTimeoutId.current) {
          clearTimeout(alertTimeoutId.current); // Clear any existing timeout
        }
        
        alertTimeoutId.current = setTimeout(() => {
          console.log("Alert threshold reached!");
          speakPostureAlert();
          
          // Set cooldown period
          lastAlertTime.current = now;
          inCooldownPeriod.current = true;
          cooldownEndTime.current = now + ALERT_COOLDOWN;
          console.log("Entering cooldown until:", new Date(cooldownEndTime.current).toLocaleTimeString());
          
          // Reset bad posture timer since we just alerted
          badPostureStartTime.current = null;
          
          // Clear the timeout
          alertTimeoutId.current = null;
        }, BAD_POSTURE_ALERT_THRESHOLD);
      }
    } else {
      // Reset bad posture tracking when posture is good
      if (badPostureStartTime.current !== null) {
        console.log("Resetting bad posture tracking - good posture detected");
        badPostureStartTime.current = null;
        
        // Clear pending alert timeout
        if (alertTimeoutId.current) {
          clearTimeout(alertTimeoutId.current);
          alertTimeoutId.current = null;
        }
      }
    }
  };

  // MODIFICATION 7: Update the speakPostureAlert function to use generalized shoulder feedback
const speakPostureAlert = () => {
  // Stop any ongoing speech
  Speech.stop();
  
  // Set alert active flag
  isAlertActive.current = true;
  
  // Check if speech is available
  Speech.isSpeakingAsync().then(isSpeaking => {
    console.log("Speech is currently:", isSpeaking ? "active" : "not active");
    
    // Create a more targeted alert message based on identified issue area
    let alertMessage = "You've been sitting with bad posture. Please adjust your position.";
    
    if (postureIssueArea) {
      switch(postureIssueArea) {
        case "shoulders":
          alertMessage = "Your shoulders need adjustment. Try bringing them back and down.";
          break;
        case "lower_back":
          alertMessage = "Your lower back needs adjustment. Try sitting more upright with better lumbar support.";
          break;
      }
    }
    
    console.log("Attempting to speak:", alertMessage);
    
    Speech.speak(alertMessage, {
      rate: 0.9,
      pitch: 1.0,
      onDone: () => {
        console.log("Speech completed");
        isAlertActive.current = false;
      },
      onError: (error) => {
        console.error("Speech error:", error);
        isAlertActive.current = false;
      }
    });
  }).catch(error => {
    console.error("Error checking speech status:", error);
  });
};
  const updatePostureBuffer = (status) => {
    // Add new status to buffer
    setPostureBuffer(prevBuffer => {
      const newBuffer = [...prevBuffer, status];
      
      // If buffer is full, analyze it and potentially send to Firebase
      if (newBuffer.length >= BUFFER_SIZE) {
        analyzePostureBuffer(newBuffer);
        // Return a new empty buffer
        return [];
      }
      
      // If buffer isn't full yet, keep collecting data
      return newBuffer;
    });
  };

  const analyzePostureBuffer = (buffer) => {
    // Count bad posture instances
    const badPostureCount = buffer.filter(status => status === "Bad Posture").length;
    
    // Calculate percentage of bad postures
    const badPosturePercentage = badPostureCount / buffer.length;
    
    // Determine overall status
    const overallStatus = badPosturePercentage >= THRESHOLD ? "Bad Posture" : "Good Posture";
    
    // Only send to Firebase if status has changed from last report
    if (overallStatus !== lastReportedStatus) {
      sendToFirebase(overallStatus);
      setLastReportedStatus(overallStatus);
    }
  };

  const sendToFirebase = async (status) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.log("No user logged in");
        return;
      }
      
      const timestamp = Timestamp.fromDate(new Date());
      
      // Create a reference to the user's posture document
      const postureRef = doc(collection(db, "users", user.uid, "posture"));
      
      // Set the document data
      await setDoc(postureRef, {
        status: status,
        timestamp: timestamp,
        userId: user.uid,
        issueArea: postureIssueArea || 'general' // Track the issue area
      });
      
      console.log(`Posture status '${status}' sent to Firebase at ${timestamp}`);
    } catch (error) {
      console.error("Error sending posture data to Firebase:", error);
    }
  };

  // More realistic human avatar with detailed spine
  const PostureAvatar = ({ isGoodPosture }) => (
    <Svg width="200" height="300" viewBox="0 0 200 300">
      <Defs>
        <LinearGradient id="bodyGradient" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F5DEB3" stopOpacity="1" />
          <Stop offset="1" stopColor="#D2B48C" stopOpacity="1" />
        </LinearGradient>
      </Defs>
      
      {isGoodPosture ? (
       
        <G>
          
          <Circle cx="100" cy="45" r="25" fill="url(#bodyGradient)" stroke="#333" strokeWidth="1.5" />
          <Circle cx="90" cy="40" r="3" fill="#333" /> 
          <Circle cx="110" cy="40" r="3" fill="#333" /> 
          <Path d="M92 55 Q100 60 108 55" stroke="#333" strokeWidth="1.5" fill="none" />
          
         
          <Line x1="100" y1="70" x2="100" y2="85" stroke="#333" strokeWidth="8" strokeLinecap="round" />
          
      
          <Path 
            d="M70 90 L70 180 C85 195 115 195 130 180 L130 90 C115 100 85 100 70 90 Z" 
            fill="url(#bodyGradient)" 
            stroke="#333" 
            strokeWidth="1.5" 
          />
          
         
          <Path 
            d="M100 85 L100 180" 
            stroke="#4CAF50" 
            strokeWidth="5" 
            strokeLinecap="round" 
            strokeDasharray="5,3"
          />
          
       
          <Path d="M70 100 L40 130" stroke="#333" strokeWidth="8" strokeLinecap="round" />
          <Path d="M130 100 L160 130" stroke="#333" strokeWidth="8" strokeLinecap="round" />
          
        
          <Path d="M70 95 Q100 80 130 95" stroke="#333" strokeWidth="2" fill="none" />
          
      
          <Path d="M85 180 L75 260" stroke="#333" strokeWidth="10" strokeLinecap="round" />
          <Path d="M115 180 L125 260" stroke="#333" strokeWidth="10" strokeLinecap="round" />
        </G>
      ) : (
      
        <G>
          
          <Circle cx="85" cy="55" r="25" fill="url(#bodyGradient)" stroke="#333" strokeWidth="1.5" />
          <Circle cx="75" cy="50" r="3" fill="#333" /> 
          <Circle cx="95" cy="50" r="3" fill="#333" />
          <Path d="M80 65 Q85 62 90 65" stroke="#333" strokeWidth="1.5" fill="none" /> 
          
      
          <Line x1="90" y1="80" x2="95" y2="95" stroke="#333" strokeWidth="8" strokeLinecap="round" />
          
         
          <Path 
            d="M65 100 L75 180 C90 195 120 195 135 180 L135 100 C120 110 80 110 65 100 Z" 
            fill="url(#bodyGradient)" 
            stroke="#333" 
            strokeWidth="1.5" 
          />
          
      
          <Path 
            d="M95 95 C100 120 110 140 105 180" 
            stroke="#F44336" 
            strokeWidth="5" 
            strokeLinecap="round" 
            strokeDasharray="5,3"
          />
          
        
          <Path d="M75 110 L45 120" stroke="#333" strokeWidth="8" strokeLinecap="round" />
          <Path d="M125 110 L155 120" stroke="#333" strokeWidth="8" strokeLinecap="round" />
          
        
          <Path d="M75 105 Q100 115 125 105" stroke="#333" strokeWidth="2" fill="none" />
          
      
          <Path d="M90 180 L80 260" stroke="#333" strokeWidth="10" strokeLinecap="round" />
          <Path d="M120 180 L130 260" stroke="#333" strokeWidth="10" strokeLinecap="round" />
        </G>
      )}
      
      {!isGoodPosture && postureIssueArea && (
        <G>
          {postureIssueArea === "shoulders" && (
            <G>
              <Circle cx="75" cy="105" r="12" fill="rgba(255,0,0,0.3)" stroke="#F44336" strokeWidth="2" />
              <Circle cx="125" cy="105" r="12" fill="rgba(255,0,0,0.3)" stroke="#F44336" strokeWidth="2" />
              <Path d="M75 105 Q100 115 125 105" stroke="#F44336" strokeWidth="2" fill="none" />
            </G>
          )}
          
          {postureIssueArea === "lower_back" && (
            <Circle cx="100" cy="160" r="15" fill="rgba(255,0,0,0.3)" stroke="#F44336" strokeWidth="2" />
          )}
        </G>
      )}
    </Svg>
  ); 
  // Calculate remaining time until alert triggers (if in bad posture)
  // or remaining cooldown time (if in cooldown period)
  const getRemainingTime = () => {
    const now = Date.now();
    
    // If in cooldown period, show cooldown timer
    if (inCooldownPeriod.current && cooldownEndTime.current) {
      const remainingCooldown = Math.max(0, cooldownEndTime.current - now);
      const cooldownMinutes = Math.floor(remainingCooldown / 60000);
      const cooldownSeconds = Math.floor((remainingCooldown % 60000) / 1000);
      return { minutes: cooldownMinutes, seconds: cooldownSeconds, isCooldown: true };
    }
    
    // If in bad posture state, show alert countdown
    if (badPostureStartTime.current !== null && prediction?.status === "Bad Posture") {
      const elapsedTime = now - badPostureStartTime.current;
      const remainingTime = Math.max(0, BAD_POSTURE_ALERT_THRESHOLD - elapsedTime);
      
      // Convert to minutes and seconds
      const minutes = Math.floor(remainingTime / 60000);
      const seconds = Math.floor((remainingTime % 60000) / 1000);
      
      return { minutes, seconds, isCooldown: false };
    }
    
    return null;
  };

  // Format timer display
  const formatTimer = () => {
    const remaining = getRemainingTime();
    if (!remaining) return null;
    
    return {
      time: `${remaining.minutes}:${remaining.seconds < 10 ? '0' : ''}${remaining.seconds}`,
      isCooldown: remaining.isCooldown
    };
  };

  // Load calibration data on component mount
  useEffect(() => {
    const loadCalibration = async () => {
      setIsLoading(true);
      const data = await fetchCalibrationData();
      setCalibrationData(data);
      setIsLoading(false);
    };
    
    loadCalibration();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      fetchPrediction();
      const interval = setInterval(fetchPrediction, 5000);
      
      // Clean up on unmount
      return () => {
        clearInterval(interval);
        if (alertTimeoutId.current) {
          clearTimeout(alertTimeoutId.current);
        }
        Speech.stop();
      };
    }
  }, [isLoading]);

  // Update timer display every second when in bad posture or cooldown
  const [timer, setTimer] = useState(null);
  
  useEffect(() => {
    let timerInterval;
    
    // Show timer during bad posture or during cooldown
    if ((prediction?.status === "Bad Posture" && badPostureStartTime.current !== null) || 
        inCooldownPeriod.current) {
      timerInterval = setInterval(() => {
        setTimer(formatTimer());
      }, 1000);
    } else {
      setTimer(null);
    }
    
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [prediction?.status]);

  // Get targeted posture tip based on the identified issue area
  // MODIFICATION 6: Update the getPostureTip function to provide generalized shoulder feedback
const getPostureTip = () => {
  if (!prediction || prediction.status === "Good Posture") return null;
  
  // Basic tip if no calibration data is available
  if (!calibrationData) {
    return "Sit with your back straight, shoulders relaxed, and weight balanced evenly.";
  }
  
  // Targeted tips based on identified issue area
  if (postureIssueArea) {
    switch(postureIssueArea) {
      case "shoulders":
        return "Your shoulders are not in proper position. Try rolling them back and down, keeping your shoulder blades flat against your back. Avoid hunching forward.";
        
      case "lower_back":
        return "Your lower back position needs adjustment. Engage your core slightly, maintain the natural curve in your lower back, and sit back fully in your chair with proper lumbar support.";
        
      default:
        return "Adjust your posture by aligning your shoulders over your hips and keeping your spine in neutral position.";
    }
  }
  
  // General tip if we have calibration but no specific issue identified
  return "Return to your calibrated sitting position. Keep your spine aligned, shoulders relaxed and back, and weight distributed evenly.";
};

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading your posture profile...</Text>
        </View>
      ) : error ? (
        <Text style={styles.errorText}>Error: {error}</Text>
      ) : prediction ? (
        <>
          <Text style={styles.headerText}>Posture Status</Text>
          
          {/* Avatar visualization */}
          <View style={styles.avatarContainer}>
            <PostureAvatar isGoodPosture={prediction.status === "Good Posture"} />
          </View>
          
          <View style={styles.predictionBox}>
            <Text
              style={[
                styles.statusText,
                prediction.status === "Good Posture" ? styles.good : styles.bad,
              ]}
            >
              {prediction.status}
            </Text>
            <Text style={styles.confidenceText}>Confidence: {prediction.confidence}</Text>
            
            {/* Show if this is a personalized override */}
            {prediction.status !== prediction.modelStatus && (
              <Text style={styles.personalizedText}>
                ✓ Personalized for your calibrated posture
              </Text>
            )}
            
            {/* Display issue area if detected with bad posture */}
            {prediction.status === "Bad Posture" && postureIssueArea && (
              <Text style={styles.issueAreaText}>
                Issue detected: {postureIssueArea === "left_shoulder" ? "Left shoulder"
                  : postureIssueArea === "right_shoulder" ? "Right shoulder" 
                  : postureIssueArea === "lower_back" ? "Lower back" 
                  : "General posture"}
              </Text>
            )}
            
            <Text style={styles.bufferText}>
              Readings: {postureBuffer.length}/{BUFFER_SIZE}
            </Text>
            
            {/* Timer display (alert countdown or cooldown period) */}
            {timer && (
              <View style={styles.alertTimerContainer}>
                <Text style={[
                  styles.alertTimerLabel,
                  timer.isCooldown ? styles.cooldownLabel : styles.alertLabel
                ]}>
                  {timer.isCooldown ? "Next alert in:" : "Alert in:"}
                </Text>
                <Text style={[
                  styles.alertTimerText,
                  timer.isCooldown ? styles.cooldownTimerText : styles.alertTimerText
                ]}>
                  {timer.time}
                </Text>
              </View>
            )}
          </View>
          
          {/* Personalized posture tip */}
          {prediction.status === "Bad Posture" && (
            <View style={[
              styles.tipContainer,
              // Apply different border color based on issue area
              postureIssueArea === "left_shoulder" ? styles.tipLeftShoulder :
              postureIssueArea === "right_shoulder" ? styles.tipRightShoulder :
              postureIssueArea === "lower_back" ? styles.tipLowerBack :
              styles.tipGeneral
            ]}>
              <Text style={styles.tipHeader}>Posture Tip:</Text>
              <Text style={styles.tipText}>
                {getPostureTip()}
              </Text>
            </View>
          )}
          
          {/* Calibration status indicator */}
          <View style={styles.calibrationContainer}>
            <Text style={styles.calibrationText}>
              {calibrationData 
                ? "✓ Using your personalized posture calibration" 
                : "⚠️ No calibration data. Consider recalibrating in settings"}
            </Text>
          </View>
          
          {/* Audio alert explanation */}
          <View style={styles.alertInfoContainer}>
            <Text style={styles.alertInfoText}>
              A voice alert will notify you after 30 seconds of continuous bad posture.
            </Text>
            <Text style={styles.alertInfoText}>
                A voice alert will notify you after 30 seconds of continuous bad posture.
              </Text>
            </View>
            
            {/* Sensor readings visualization - only show when in bad posture */}
            {prediction.status === "Bad Posture" && sensorDeviations && (
              <View style={styles.sensorReadingsContainer}>
                <Text style={styles.sensorReadingsHeader}>Sensor Analysis:</Text>
                <View style={styles.sensorBarContainer}>
                  {/* Create mini bar charts for each sensor group */}
                  <View style={styles.sensorGroup}>
                    <Text style={styles.sensorGroupLabel}>Left Shoulder</Text>
                    <View style={styles.sensorBar}>
                      <View 
                        style={[
                          styles.sensorBarFill, 
                          {
                            width: `${Math.min(100, Math.max(0, 
                              (((sensorDeviations.yaw1 || 0) + 
                               (sensorDeviations.pitch1 || 0) + 
                               (sensorDeviations.roll1 || 0)) / 3) * 100
                            ))}%`,
                            backgroundColor: postureIssueArea === "left_shoulder" ? "#FF5252" : "#FFC107"
                          }
                        ]} 
                      />
                    </View>
                  </View>
                  
                  <View style={styles.sensorGroup}>
                    <Text style={styles.sensorGroupLabel}>Right Shoulder</Text>
                    <View style={styles.sensorBar}>
                      <View 
                        style={[
                          styles.sensorBarFill, 
                          {
                            width: `${Math.min(100, Math.max(0, 
                              (((sensorDeviations.yaw2 || 0) + 
                               (sensorDeviations.pitch2 || 0) + 
                               (sensorDeviations.roll2 || 0)) / 3) * 100
                            ))}%`,
                            backgroundColor: postureIssueArea === "right_shoulder" ? "#FF5252" : "#FFC107"
                          }
                        ]} 
                      />
                    </View>
                  </View>
                  
                  <View style={styles.sensorGroup}>
                    <Text style={styles.sensorGroupLabel}>Lower Back</Text>
                    <View style={styles.sensorBar}>
                      <View 
                        style={[
                          styles.sensorBarFill, 
                          {
                            width: `${Math.min(100, Math.max(0, 
                              (sensorDeviations.flex_angle1 || 0) * 100
                            ))}%`,
                            backgroundColor: postureIssueArea === "lower_back" ? "#FF5252" : "#FFC107"
                          }
                        ]} 
                      />
                    </View>
                  </View>
                </View>
              </View>
            )}
          </>
        ) : (
          <Text style={styles.loadingText}>Waiting for predictions...</Text>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    backgroundColor: "#f5f5f5", 
    padding: 20 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerText: { 
    fontSize: 28, 
    fontWeight: "bold", 
    marginBottom: 20,
    color: "#2C3E50"
  },
  avatarContainer: {
    marginBottom: 20,
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 20,
    padding: 15,
    width: 240,
    height: 320,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  predictionBox: {
    padding: 20,
    borderRadius: 15,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
    alignItems: "center",
    width: "90%",
    marginBottom: 20
  },
  statusText: { 
    fontSize: 24, 
    fontWeight: "bold", 
    marginBottom: 10 
  },
  good: { 
    color: "#4CAF50" 
  },
  bad: { 
    color: "#F44336" 
  },
  confidenceText: { 
    fontSize: 16, 
    color: "#444",
    marginBottom: 10 
  },
  personalizedText: {
    fontSize: 14,
    color: "#4CAF50",
    fontStyle: "italic",
    marginBottom: 8
  },
  issueAreaText: {
    fontSize: 15,
    color: "#F44336",
    fontWeight: "500",
    marginBottom: 8
  },
  bufferText: { 
    fontSize: 14, 
    color: "#666",
    marginBottom: 8
  },
  alertTimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    width: '100%',
    justifyContent: 'center'
  },
  alertLabel: {
    color: '#F44336',
  },
  cooldownLabel: {
    color: '#2196F3',
  },
  alertTimerLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 5
  },
  alertTimerText: {
    fontSize: 16,
    color: '#F44336',
    fontWeight: 'bold'
  },
  cooldownTimerText: {
    fontSize: 16,
    color: '#2196F3', // Blue color for cooldown
    fontWeight: 'bold'
  },
  loadingText: { 
    fontSize: 16, 
    color: "#999" 
  },
  errorText: { 
    color: "#F44336", 
    textAlign: "center",
    fontSize: 16 
  },
  tipContainer: {
    backgroundColor: "#E3F2FD",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    width: "90%",
    borderLeftWidth: 4,
  },
  tipLeftShoulder: {
    borderLeftColor: "#9C27B0", // Purple for left shoulder
  },
  tipRightShoulder: {
    borderLeftColor: "#FF9800", // Orange for right shoulder
  },
  tipLowerBack: {
    borderLeftColor: "#F44336", // Red for lower back
  },
  tipGeneral: {
    borderLeftColor: "#2196F3", // Default blue
  },
  tipHeader: {
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 5,
    color: "#2196F3"
  },
  tipText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20
  },
  calibrationContainer: {
    width: "90%",
    padding: 10,
    backgroundColor: "#f0f8ff",
    borderRadius: 8,
    marginBottom: 10
  },
  calibrationText: {
    fontSize: 12,
    color: "#444",
    textAlign: "center",
    fontStyle: "italic"
  },
  alertInfoContainer: {
    width: '90%',
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    marginBottom: 15
  },
  alertInfoText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic'
  },
  sensorReadingsContainer: {
    width: '90%',
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  sensorReadingsHeader: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333'
  },
  sensorBarContainer: {
    width: '100%',
  },
  sensorGroup: {
    marginBottom: 8,
  },
  sensorGroupLabel: {
    fontSize: 12,
    color: '#555',
    marginBottom: 3
  },
  sensorBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  sensorBarFill: {
    height: '100%',
    borderRadius: 4,
  }
});