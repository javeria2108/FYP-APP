import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-chart-kit';
import { useRouter } from 'expo-router';
import Svg, { 
  Circle, 
  Rect, 
  Line, 
  Path 
} from 'react-native-svg';

// Posture status colors
const POSTURE_COLORS = {
  GOOD: '#4CAF50',    // Green
  OKAY: '#FFC107',    // Yellow
  BAD: '#F44336'      // Red
};

// Detailed Character Component
const PostureCharacter = ({ status }) => {
  const getStatusColor = () => {
    switch(status) {
      case 'GOOD': return POSTURE_COLORS.GOOD;
      case 'OKAY': return POSTURE_COLORS.OKAY;
      case 'BAD': return POSTURE_COLORS.BAD;
      default: return 'gray';
    }
  };

  return (
    <Svg width="200" height="300" viewBox="0 0 200 300">
      {/* Head */}
      <Circle 
        cx="100" 
        cy="50" 
        r="40" 
        fill={getStatusColor()}
        stroke="black"
        strokeWidth="2"
      />
      
      {/* Eyes */}
      <Circle 
        cx="80" 
        cy="40" 
        r="5" 
        fill="white"
      />
      <Circle 
        cx="120" 
        cy="40" 
        r="5" 
        fill="white"
      />
      
      {/* Mouth - changes based on posture */}
      {status === 'GOOD' && (
        <Path
          d="M80 70 Q100 85, 120 70"
          fill="none"
          stroke="black"
          strokeWidth="3"
        />
      )}
      
      {status === 'OKAY' && (
        <Line
          x1="80"
          y1="75"
          x2="120"
          y2="75"
          stroke="black"
          strokeWidth="3"
        />
      )}
      
      {status === 'BAD' && (
        <Path
          d="M80 85 Q100 70, 120 85"
          fill="none"
          stroke="black"
          strokeWidth="3"
        />
      )}
      
      {/* Body */}
      <Rect 
        x="70" 
        y="90" 
        width="60" 
        height="100" 
        fill={getStatusColor()}
        stroke="black"
        strokeWidth="2"
      />
      
      {/* Arms */}
      <Line
        x1="50"
        y1="120"
        x2="70"
        y2="150"
        stroke="black"
        strokeWidth="3"
      />
      <Line
        x1="150"
        y1="120"
        x2="130"
        y2="150"
        stroke="black"
        strokeWidth="3"
      />
      
      {/* Legs */}
      <Line
        x1="85"
        y1="190"
        x2="70"
        y2="250"
        stroke="black"
        strokeWidth="3"
      />
      <Line
        x1="115"
        y1="190"
        x2="130"
        y2="250"
        stroke="black"
        strokeWidth="3"
      />
    </Svg>
  );
};

export default function PostureMonitorApp() {
  const router = useRouter();
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [postureStatus, setPostureStatus] = useState('NEUTRAL');
  const [postureData, setPostureData] = useState([50, 60, 45, 55, 70]);
  const intervalRef = useRef(null);

  const toggleMonitoring = () => {
    // If currently monitoring, stop the interval
    if (isMonitoring) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsMonitoring(false);
      // Reset to neutral state when stopped
      setPostureStatus('NEUTRAL');
      setPostureData([50, 60, 45, 55, 70]);
    } else {
      // Start monitoring
      setIsMonitoring(true);
      
      // Simulate posture changes
      intervalRef.current = setInterval(() => {
        const randomValue = Math.random() * 100;
        let status = 'OKAY';
        
        if (randomValue < 30) status = 'BAD';
        else if (randomValue > 70) status = 'GOOD';
        
        setPostureStatus(status);
        
        // Update graph data
        setPostureData(prevData => {
          const newData = [...prevData.slice(1), randomValue];
          return newData;
        });
      }, 2000);
    }
  };

  // Cleanup interval on component unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Posture Monitor</Text>
      
      {/* Posture Character Indicator */}
      <PostureCharacter status={postureStatus} />
      
      {/* Posture Graph */}
      <View style={styles.chartContainer}>
        <LineChart
          data={{
            labels: ['1', '2', '3', '4', '5'],
            datasets: [
              {
                data: postureData
              }
            ]
          }}
          width={Dimensions.get('window').width - 40}
          height={220}
          chartConfig={{
            backgroundColor: '#e26a00',
            backgroundGradientFrom: '#fb8c00',
            backgroundGradientTo: '#ffa726',
            decimalPlaces: 2,
            color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
            style: {
              borderRadius: 16
            },
            propsForDots: {
              r: "6",
              strokeWidth: "2",
              stroke: "#ffa726"
            }
          }}
          bezier
          style={{
            marginVertical: 8,
            borderRadius: 16
          }}
        />
      </View>
      
      {/* Monitoring Button */}
      <TouchableOpacity 
        style={[
          styles.monitorButton, 
          { 
            backgroundColor: isMonitoring ? POSTURE_COLORS.BAD : POSTURE_COLORS.GOOD 
          }
        ]}
        onPress={() => router.replace('/postureStatus')}

      >
        <Text style={styles.buttonText}>
          {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5FCFF',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  chartContainer: {
    marginVertical: 20,
  },
  monitorButton: {
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
  },
});