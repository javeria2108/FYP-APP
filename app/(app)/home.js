import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { useRouter } from 'expo-router';
import { collection, query, where, orderBy, getDocs, limit, Timestamp } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [stats, setStats] = useState({
    longestGoodStreak: 0,
    weeklyImprovement: 0,
    todayGoodPercentage: 0,
    totalSessionsToday: 0
  });
  const [activeTab, setActiveTab] = useState('week');

  // Function to get day name from date
  const getDayName = (date) => {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
  };

  // Create a default empty chart data structure
  const emptyChart = (labelsCount = 7) => ({
    labels: Array(labelsCount).fill(""),
    datasets: [
      { data: Array(labelsCount).fill(0),
        color: () => "rgba(76,175,80,0.2)" },   // good
      { data: Array(labelsCount).fill(0),
        color: () => "rgba(244,67,54,0.2)" },  // bad
    ],
    legend: ["Good Posture", "Bad Posture"],
  });

  // Function to get posture data from Firebase
  const fetchPostureData = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      
      if (!user) {
        console.log("No user logged in");
        setLoading(false);
        return;
      }

      // Get today's date at 00:00:00
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get date from 7 days ago
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      
      // Get date from 30 days ago
      const lastMonth = new Date(today);
      lastMonth.setDate(lastMonth.getDate() - 30);

      // Query for getting posture data
      const postureRef = collection(db, "users", user.uid, "posture");
      const weeklyQuery = query(
         postureRef,
          orderBy("timestamp", "asc"),
          where("timestamp", ">=", Timestamp.fromDate(lastWeek))
        );
        const monthlyQuery = query(
            postureRef,
            orderBy("timestamp", "asc"),
            where("timestamp", ">=", Timestamp.fromDate(lastMonth))
          );

          const [weeklySnapshot, monthlySnapshot] = await Promise.all([
            getDocs(weeklyQuery),
            getDocs(monthlyQuery),
          ]);
      
          console.log("Weekly docs:", weeklySnapshot.size);
          console.log("Monthly docs:", monthlySnapshot.size);
          

          const processedWeekly = processWeeklyData(weeklySnapshot);
          const processedMonthly = processMonthlyData(monthlySnapshot);
          console.log("const processedMonthly:",processedMonthly)
      
          console.log("Processed Weekly Data:", processedWeekly);
          console.log("Processed Monthly Data:", processedMonthly);
          console.log("Monthly Dataset 0:", processedMonthly.datasets[0].data);
console.log("Monthly Dataset 1:", processedMonthly.datasets[1].data);
      
          if (processedWeekly && processedWeekly.labels && processedWeekly.datasets) {
            setWeeklyData(processedWeekly);
          } else {
            console.log("Weekly data processing failed");
            setWeeklyData(emptyChart(7)); // fallback to empty chart
          }
      
          if (processedMonthly && processedMonthly.labels && processedMonthly.datasets) {
            setMonthlyData(processedMonthly);
          } else {
            console.log("Monthly data processing failed");
            setMonthlyData(emptyChart(4)); // fallback to empty chart
          }

      // Calculate stats
      calculateStats(weeklySnapshot, monthlySnapshot);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching posture data:", error);
      setLoading(false);
    }
  };

  // Process weekly data for charts
  const processWeeklyData = (snapshot) => {
    if (snapshot.empty) return emptyChart(7);
    const weekDays = [];
    const goodPostureData = [];
    const badPostureData = [];
    
    // Initialize arrays for the past 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      weekDays.push(getDayName(date));
      goodPostureData.push(0);
      badPostureData.push(0);
    }
    
    // Fill in data from Firebase
    snapshot.forEach(doc => {
      const data = doc.data();
      const timestamp = data.timestamp.toDate();
      const dayIndex = 6 - Math.floor((new Date() - timestamp) / (1000 * 60 * 60 * 24));
      
      if (dayIndex >= 0 && dayIndex <= 6) {
        if (data.status === 'Good Posture') {
          goodPostureData[dayIndex]++;
        } else {
          badPostureData[dayIndex]++;
        }
      }
    });
    
    return {
      labels: weekDays,
      datasets: [
        {
          data: goodPostureData,
          color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
          strokeWidth: 2,
          label: 'Good Posture'
        },
        {
          data: badPostureData,
          color: (opacity = 1) => `rgba(244, 67, 54, ${opacity})`,
          strokeWidth: 2,
          label: 'Bad Posture'
        }
      ],
      legend: ["Good Posture", "Bad Posture"]
    };
  };

  const processMonthlyData = (snapshot) => {
    if (!snapshot || snapshot.empty) return emptyChart(4);
  
    const weeks = ["Week 1", "Week 2", "Week 3", "Week 4"];
    const goodPostureByWeek = [0, 0, 0, 0];
    const badPostureByWeek = [0, 0, 0, 0];
  
    snapshot.forEach(doc => {
      const data = doc.data();
  
      if (!data || !data.timestamp || !data.status) {
        console.warn("Skipping invalid document:", doc.id, data);
        return; // skip bad docs
      }
  
      let timestamp;
      try {
        timestamp = data.timestamp.toDate();
      } catch (error) {
        console.warn("Invalid timestamp for doc:", doc.id);
        return; // skip bad timestamp
      }
  
      const now = new Date();
      const daysAgo = Math.floor((now - timestamp) / (1000 * 60 * 60 * 24));
  
      let weekIndex;
      if (daysAgo < 7) weekIndex = 3;
      else if (daysAgo < 14) weekIndex = 2;
      else if (daysAgo < 21) weekIndex = 1;
      else if (daysAgo < 30) weekIndex = 0;
      else return; // too old, skip
  
      if (data.status === 'Good Posture') {
        goodPostureByWeek[weekIndex]++;
      } else {
        badPostureByWeek[weekIndex]++;
      }
    });
  
    return {
      labels: weeks,
      datasets: [
        {
          data: goodPostureByWeek,
          color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
          strokeWidth: 2
        },
        {
          data: badPostureByWeek,
          color: (opacity = 1) => `rgba(244, 67, 54, ${opacity})`,
          strokeWidth: 2
        }
      ],
      legend: ["Good Posture", "Bad Posture"]
    };
  };
  
  // Calculate various stats
  const calculateStats = (weeklySnapshot, monthlySnapshot) => {
    // Initialize counters
    let longestStreak = 0;
    let currentStreak = 0;
    let previousGoodPercentage = 0;
    let currentGoodPercentage = 0;
    let todayGood = 0;
    let todayTotal = 0;
    
    // Get today's date at 00:00:00
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get date from 7 days ago
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    // Get date from 14 days ago
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    // Process data for today's percentage
    weeklySnapshot.forEach(doc => {
      const data = doc.data();
      const timestamp = data.timestamp.toDate();
      
      // Check if this entry is from today
      if (timestamp >= today) {
        todayTotal++;
        if (data.status === 'Good Posture') {
          todayGood++;
        }
      }
    });
    
    // Calculate today's good posture percentage
    const todayGoodPercentage = todayTotal > 0 ? Math.round((todayGood / todayTotal) * 100) : 0;
    
    // Count good/bad entries for the past week and the week before
    let pastWeekGood = 0;
    let pastWeekTotal = 0;
    let weekBeforeGood = 0;
    let weekBeforeTotal = 0;
    
    monthlySnapshot.forEach(doc => {
      const data = doc.data();
      const timestamp = data.timestamp.toDate();
      
      // Check which time period this entry belongs to
      if (timestamp >= lastWeek) {
        pastWeekTotal++;
        if (data.status === 'Good Posture') {
          pastWeekGood++;
        }
      } else if (timestamp >= twoWeeksAgo && timestamp < lastWeek) {
        weekBeforeTotal++;
        if (data.status === 'Good Posture') {
          weekBeforeGood++;
        }
      }
    });
    
    // Calculate percentages for comparison
    currentGoodPercentage = pastWeekTotal > 0 ? (pastWeekGood / pastWeekTotal) * 100 : 0;
    previousGoodPercentage = weekBeforeTotal > 0 ? (weekBeforeGood / weekBeforeTotal) * 100 : 0;
    
    // Calculate weekly improvement
    let weeklyImprovement = previousGoodPercentage > 0 
      ? Math.round(((currentGoodPercentage - previousGoodPercentage) / previousGoodPercentage) * 100)
      : 0;
    
    // Fix edge cases
    if (isNaN(weeklyImprovement) || !isFinite(weeklyImprovement)) weeklyImprovement = 0;
    
    // Calculate longest good posture streak
    // Sort entries by timestamp
    const entries = [];
    weeklySnapshot.forEach(doc => {
      entries.push(doc.data());
    });
    entries.sort((a, b) => a.timestamp.seconds - b.timestamp.seconds);
    
    // Find longest streak
    let tempStreak = 0;
    entries.forEach(entry => {
      if (entry.status === 'Good Posture') {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    });
    
    // Update state with calculated stats
    setStats({
      longestGoodStreak: longestStreak,
      weeklyImprovement: weeklyImprovement,
      todayGoodPercentage: todayGoodPercentage,
      totalSessionsToday: todayTotal
    });
  };

  useEffect(() => {
    fetchPostureData();
    
    // Set up an interval to refresh data every minute
    const interval = setInterval(fetchPostureData, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const chartConfig = {
    backgroundGradientFrom: "#fff",
    backgroundGradientTo: "#fff",
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: true,
    decimalPlaces: 0,
  };

  const screenWidth = Dimensions.get("window").width - 40;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Posture Dashboard</Text>
        
        {loading ? (
          <ActivityIndicator size="large" color="#2196F3" style={styles.loader} />
        ) : (
          <>
            {/* Stats Cards */}
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Ionicons name="time-outline" size={24} color="#4CAF50" />
                <Text style={styles.statValue}>{stats.longestGoodStreak}</Text>
                <Text style={styles.statLabel}>Longest Streak</Text>
              </View>
              
              <View style={styles.statCard}>
                <Ionicons 
                  name={stats.weeklyImprovement >= 0 ? "trending-up" : "trending-down"} 
                  size={24} 
                  color={stats.weeklyImprovement >= 0 ? "#4CAF50" : "#F44336"} 
                />
                <Text 
                  style={[
                    styles.statValue, 
                    {color: stats.weeklyImprovement >= 0 ? "#4CAF50" : "#F44336"}
                  ]}
                >
                  {stats.weeklyImprovement > 0 ? '+' : ''}{stats.weeklyImprovement}%
                </Text>
                <Text style={styles.statLabel}>Weekly Change</Text>
              </View>
              
              <View style={styles.statCard}>
                <Ionicons name="today-outline" size={24} color="#2196F3" />
                <Text style={styles.statValue}>{stats.todayGoodPercentage}%</Text>
                <Text style={styles.statLabel}>Today's Good</Text>
              </View>
            </View>
            
            {/* Chart Period Tabs */}
            <View style={styles.tabContainer}>
              <TouchableOpacity 
                style={[styles.tab, activeTab === 'week' && styles.activeTab]}
                onPress={() => setActiveTab('week')}
              >
                <Text style={[styles.tabText, activeTab === 'week' && styles.activeTabText]}>Weekly</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.tab, activeTab === 'month' && styles.activeTab]}
                onPress={() => setActiveTab('month')}
              >
                {/* <Text style={[styles.tabText, activeTab === 'month' && styles.activeTabText]}>Monthly</Text> */}
              </TouchableOpacity>
            </View>
            
            {/* Charts */}
            <View style={styles.chartContainer}>
              {activeTab === 'week' ? (
                weeklyData ? (
                  <LineChart
                    data={weeklyData}
                    width={screenWidth}
                    height={220}
                    chartConfig={chartConfig}
                    bezier
                    style={styles.chart}
                    verticalLabelRotation={0}
                    fromZero
                    yAxisSuffix=""
                    yAxisLabel=""
                    legend={weeklyData.legend || ["Good Posture", "Bad Posture"]}
                  />
                ) : (
                  <Text style={styles.noDataText}>No weekly data available</Text>
                )
              ) : (
                monthlyData ? (
                  <BarChart
                  data={monthlyData}
                  width={screenWidth}
                  height={220}
                  chartConfig={chartConfig}
                  style={styles.chart}
                  verticalLabelRotation={0}
                  yAxisSuffix=""
                  showBarTops={false}
                  fromZero
                  withInnerLines={true}
                  segments={4}
                  yAxisLabel=""
                />

                ) : (
                  <Text style={styles.noDataText}>No monthly data available</Text>
                )
              )}
            </View>
            
            {/* Today's Progress Card */}
            <View style={styles.progressCard}>
              <Text style={styles.progressTitle}>Today's Progress</Text>
              <View style={styles.progressBarContainer}>
                <View 
                  style={[
                    styles.progressBar, 
                    {width: `${stats.todayGoodPercentage}%`}
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {stats.todayGoodPercentage}% good posture ({stats.totalSessionsToday} sessions today)
              </Text>
            </View>
            
            {/* Insights Card (conditional message based on stats) */}
            <View style={styles.insightCard}>
              <Text style={styles.insightTitle}>Posture Insights</Text>
              <Text style={styles.insightText}>
                {stats.weeklyImprovement > 10 ? 
                  `Great job! You've improved your posture by ${stats.weeklyImprovement}% this week.` :
                  stats.weeklyImprovement > 0 ?
                  `You're making progress! Your posture has improved by ${stats.weeklyImprovement}% this week.` :
                  stats.weeklyImprovement < 0 ?
                  `Your posture has declined by ${Math.abs(stats.weeklyImprovement)}% this week. Try to be more mindful.` :
                  `Maintain consistency in your posture practice for better results.`
                }
              </Text>
              {stats.longestGoodStreak > 5 && (
                <Text style={styles.insightText}>
                  Your longest streak of good posture is {stats.longestGoodStreak} consecutive sessions!
                </Text>
              )}
            </View>
            
            {/* Monitor Button */}
            <TouchableOpacity 
              style={styles.monitorButton} 
              onPress={() => router.push('/postureStatus')}
            >
              <Text style={styles.buttonText}>Monitor Your Posture Now</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5FCFF',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#2C3E50',
    textAlign: 'center',
  },
  loader: {
    marginTop: 50,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    width: '30%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    borderRadius: 25,
    backgroundColor: '#E0E0E0',
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 25,
  },
  activeTab: {
    backgroundColor: '#2196F3',
  },
  tabText: {
    fontWeight: '600',
    color: '#555',
  },
  activeTabText: {
    color: 'white',
  },
  chartContainer: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    alignItems: 'center',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 10,
  },
  noDataText: {
    textAlign: 'center',
    color: '#999',
    marginVertical: 30,
  },
  progressCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#2C3E50',
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 6,
  },
  progressText: {
    fontSize: 14,
    color: '#555',
  },
  insightCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  insightTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#1565C0',
  },
  insightText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 8,
  },
  monitorButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});