import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { collection, doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';

export default function PostureStatusScreen() {
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState(null);

  const API_URL = "http://192.168.1.106:5000/latest-prediction"; // Use the IP address of the server


  const fetchPrediction = async () => {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error("Failed to fetch prediction");
      const data = await response.json();

      setPrediction({
        status: data.status === 1 ? "Good Posture" : "Bad Posture",
        confidence: (parseFloat(data.confidence) * 100).toFixed(2) + "%",
      });
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

 

  useEffect(() => {
    fetchPrediction();
    const interval = setInterval(fetchPrediction, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      {error ? (
        <Text style={styles.errorText}>Error: {error}</Text>
      ) : prediction ? (
        <>
          <Text style={styles.headerText}>Posture Status</Text>
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
          </View>
        </>
      ) : (
        <Text style={styles.loadingText}>Waiting for predictions...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f5f5f5", padding: 20 },
  headerText: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  predictionBox: {
    padding: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
    alignItems: "center",
  },
  statusText: { fontSize: 22, fontWeight: "bold", marginBottom: 10 },
  good: { color: "green" },
  bad: { color: "red" },
  confidenceText: { fontSize: 16, color: "#444" },
  loadingText: { fontSize: 16, color: "#999" },
  errorText: { color: "red", textAlign: "center" },
});
