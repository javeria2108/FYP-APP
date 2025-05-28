import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

export default function PatientStatsScreen() {
  const router = useRouter();
  const { patientId, patientName } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [patientData, setPatientData] = useState(null);
  const [statsDetails, setStatsDetails] = useState({
    totalSessions: 0,
    goodPosturePercentage: 0,
    lastWeekSessions: 0,
    improvement: 0
  });

  useEffect(() => {
    fetchPatientData();
  }, [patientId]);

  const fetchPatientData = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users", patientId, "posture"));
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      
      const processedData = processPostureData(arr);
      setPatientData(processedData);
      
      // Calculate additional stats
      if (arr.length > 0) {
        const goodPostureSessions = arr.filter(item => item.status === 'Good Posture').length;
        const totalSessions = arr.length;
        const goodPosturePercentage = Math.round((goodPostureSessions / totalSessions) * 100);
        
        // Get data from the last 7 days
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const lastWeekSessions = arr.filter(item => 
          new Date(item.timestamp.seconds * 1000) >= oneWeekAgo
        ).length;
        
        // Calculate improvement (mock calculation)
        const improvement = Math.round(Math.random() * 20) - 5; // Just for demo
        
        setStatsDetails({
          totalSessions,
          goodPosturePercentage,
          lastWeekSessions,
          improvement
        });
      }
    } catch (e) {
      console.error("Error fetching patient data:", e);
    } finally {
      setLoading(false);
    }
  };

  const processPostureData = (data) => {
    if (!data?.length) return null;
    
    // Sort data by timestamp
    data.sort((a, b) => a.timestamp.seconds - b.timestamp.seconds);
    
    // Group data by date
    const grouped = {};
    data.forEach(item => {
      const date = new Date(item.timestamp.seconds * 1000).toLocaleDateString();
      if (!grouped[date]) grouped[date] = { good: 0, bad: 0 };
      grouped[date][item.status === 'Good Posture' ? 'good' : 'bad']++;
    });
    
    // Get the last 7 days of data
    const labels = Object.keys(grouped).slice(-7);
    const good = labels.map(d => grouped[d].good);
    const bad = labels.map(d => grouped[d].bad);
    const pct = labels.map((_, i) => {
      const t = good[i] + bad[i];
      return t ? Math.round((good[i] / t) * 100) : 0;
    });
    
    return {
      labels: labels.map(d => d.slice(5)), // Format as MM/DD
      datasets: [
        { data: good, color: () => 'rgba(76,175,80,1)', strokeWidth: 2 },
        { data: bad, color: () => 'rgba(244,67,54,1)', strokeWidth: 2 }
      ],
      legend: ["Good Posture", "Bad Posture"],
      percentages: pct
    };
  };

  const chartConfig = {
    backgroundGradientFrom: "#fff",
    backgroundGradientTo: "#fff",
    color: () => 'rgba(0,0,0,1)',
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: true
  };

  const screenWidth = Dimensions.get("window").width - 40;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#4f46e5" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{patientName}'s Stats</Text>
        <View style={styles.placeholder} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={styles.loader} />
      ) : (
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary Stats Cards */}
          <View style={styles.statsCardsContainer}>
            <View style={styles.statsCard}>
              <Text style={styles.statsValue}>{statsDetails.totalSessions}</Text>
              <Text style={styles.statsLabel}>Total Sessions</Text>
            </View>
            
            <View style={styles.statsCard}>
              <Text style={styles.statsValue}>{statsDetails.goodPosturePercentage}%</Text>
              <Text style={styles.statsLabel}>Good Posture</Text>
            </View>
            
            <View style={styles.statsCard}>
              <Text style={styles.statsValue}>{statsDetails.lastWeekSessions}</Text>
              <Text style={styles.statsLabel}>Last 7 Days</Text>
            </View>
            
            <View style={styles.statsCard}>
              <Text style={[
                styles.statsValue,
                {color: statsDetails.improvement >= 0 ? '#4CAF50' : '#F44336'}
              ]}>
                {statsDetails.improvement > 0 ? '+' : ''}{statsDetails.improvement}%
              </Text>
              <Text style={styles.statsLabel}>Improvement</Text>
            </View>
          </View>

          {/* Posture Chart */}
          <View style={styles.chartCard}>
            <Text style={styles.sectionTitle}>Posture History</Text>
            
            {patientData ? (
              <LineChart
                data={patientData}
                width={screenWidth}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                verticalLabelRotation={30}
                fromZero
                legend={patientData.legend}
              />
            ) : (
              <Text style={styles.noDataText}>No posture data available</Text>
            )}
          </View>

          {/* Daily Stats */}
          {patientData && patientData.percentages && (
            <View style={styles.dailyStatsCard}>
              <Text style={styles.sectionTitle}>Daily Good Posture Percentage</Text>
              
              {patientData.labels.map((day, index) => (
                <View key={index} style={styles.dailyStat}>
                  <Text style={styles.dateLabel}>{day}</Text>
                  <View style={styles.percentageContainer}>
                    <View 
                      style={[
                        styles.percentageBar, 
                        {
                          width: `${patientData.percentages[index]}%`,
                          backgroundColor: patientData.percentages[index] > 70 
                            ? '#4CAF50' 
                            : patientData.percentages[index] > 40 
                              ? '#FF9800' 
                              : '#F44336'
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.percentageText}>{patientData.percentages[index]}%</Text>
                </View>
              ))}
            </View>
          )}

          {/* Insights Card */}
          <View style={styles.insightsCard}>
            <Text style={styles.sectionTitle}>Insights</Text>
            <View style={styles.insightItem}>
              <Ionicons name="analytics-outline" size={22} color="#4f46e5" style={styles.insightIcon} />
              <Text style={styles.insightText}>
                {statsDetails.goodPosturePercentage > 70 
                  ? `${patientName} maintains good posture ${statsDetails.goodPosturePercentage}% of the time, which is excellent.`
                  : statsDetails.goodPosturePercentage > 50 
                    ? `${patientName} has good posture ${statsDetails.goodPosturePercentage}% of the time, with room for improvement.`
                    : `${patientName} struggles with maintaining good posture, with only ${statsDetails.goodPosturePercentage}% good posture sessions.`
                }
              </Text>
            </View>
            
            <View style={styles.insightItem}>
              <Ionicons name="trending-up-outline" size={22} color="#4f46e5" style={styles.insightIcon} />
              <Text style={styles.insightText}>
                {statsDetails.improvement > 5 
                  ? `Shows significant improvement of ${statsDetails.improvement}% in posture habits recently.`
                  : statsDetails.improvement > 0 
                    ? `Shows slight improvement of ${statsDetails.improvement}% in posture habits.`
                    : `Shows a decline of ${Math.abs(statsDetails.improvement)}% in posture habits. Consider scheduling a follow-up.`
                }
              </Text>
            </View>
            
            <View style={styles.insightItem}>
              <Ionicons name="calendar-outline" size={22} color="#4f46e5" style={styles.insightIcon} />
              <Text style={styles.insightText}>
                {statsDetails.lastWeekSessions > 20 
                  ? `Highly engaged with ${statsDetails.lastWeekSessions} sessions in the past week.`
                  : statsDetails.lastWeekSessions > 10 
                    ? `Moderately engaged with ${statsDetails.lastWeekSessions} sessions in the past week.`
                    : `Low engagement with only ${statsDetails.lastWeekSessions} sessions in the past week.`
                }
              </Text>
            </View>
          </View>
          
          {/* Action Button */}
          <TouchableOpacity style={styles.contactButton}>
            <Ionicons name="chatbubble-outline" size={20} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Contact Patient</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  placeholder: {
    width: 24,
  },
  scrollContent: {
    padding: 15,
    paddingBottom: 30,
  },
  statsCardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statsCard: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 5,
  },
  statsLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  chartCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
    color: '#374151',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 8,
  },
  dailyStatsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dailyStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateLabel: {
    width: 35,
    fontSize: 12,
    color: '#6B7280',
  },
  percentageContainer: {
    flex: 1,
    height: 10,
    backgroundColor: '#E5E7EB',
    borderRadius: 5,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  percentageBar: {
    height: '100%',
    borderRadius: 5,
  },
  percentageText: {
    width: 35,
    fontSize: 12,
    color: '#374151',
    textAlign: 'right',
  },
  insightsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  insightItem: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  insightIcon: {
    marginRight: 10,
    marginTop: 1,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  contactButton: {
    backgroundColor: '#4f46e5',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    marginTop: 5,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 30,
  },
});