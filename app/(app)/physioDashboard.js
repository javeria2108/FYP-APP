import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../../firebase';

export default function PhysioDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [patientsList, setPatientsList] = useState([]);
  const [userDetails, setUserDetails] = useState(null);

  // Updated getUserData function
  const getUserData = async () => {
    try {
      // First try to get from AsyncStorage
      const json = await AsyncStorage.getItem('user');
      if (!json) return null;
      
      const parsed = JSON.parse(json);
      console.log('⮕ Loaded userDetails from AsyncStorage:', parsed);
      
      // Make sure we have the ID (this is crucial)
      if (!parsed.id && auth.currentUser) {
        parsed.id = auth.currentUser.uid;
      }
      
      // Always fetch the latest data from Firestore to ensure we have updated patients array
      if (parsed.id) {
        const userDocRef = doc(db, "users", parsed.id);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          // Merge the fresh data with what we had
          const freshData = { id: parsed.id, ...userDocSnap.data() };
          console.log('⮕ Refreshed user data from Firestore:', freshData);
          
          // Update AsyncStorage with fresh data
          await AsyncStorage.setItem('user', JSON.stringify(freshData));
          
          setUserDetails(freshData);
          return freshData;
        }
      }
      
      setUserDetails(parsed);
      return parsed;
    } catch (e) {
      console.error("Error reading user from storage:", e);
      return null;
    }
  };

  // Fetch patients array or fallback by physiotherapistId
  const fetchPatients = async (physio) => {
    if (!physio?.id) {
      console.warn("⮕ fetchPatients called with no physio.id");
      return;
    }
    setLoading(true);
    try {
      const physioSnap = await getDoc(doc(db, "users", physio.id));
      const pdata = physioSnap.data() || {};
      const list = [];

      if (Array.isArray(pdata.patients) && pdata.patients.length) {
        for (const pid of pdata.patients) {
          const pSnap = await getDoc(doc(db, "users", pid));
          if (pSnap.exists()) list.push({ id: pSnap.id, ...pSnap.data() });
        }
      } else {
        const q = query(
          collection(db, "users"),
          where("physiotherapistId", "==", physio.id)
        );
        const snap = await getDocs(q);
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      }

      console.log("⮕ fetchPatients found:", list);
      setPatientsList(list);
    } catch (e) {
      console.error("Error fetching patients:", e);
    } finally {
      setLoading(false);
    }
  };

  // Handle patient selection - navigate to patient stats screen
  const handlePatientSelect = (patient) => {
    router.push({
      pathname: '/patientStatsScreen',
      params: { patientId: patient.id, patientName: `${patient.firstName} ${patient.lastName}` }
    });
  };

  // Initialization: load user, then patients
  useEffect(() => {
    (async () => {
      setLoading(true);
      const u = await getUserData();
      if (u) {
        await fetchPatients(u);
      } else {
        console.warn("⮕ No userData found in AsyncStorage");
      }
      setLoading(false);
    })();
  }, []);

  // Logout handler
  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('user');
      await auth.signOut();
      router.replace('/signin');
    } catch (e) {
      console.error("Error logging out:", e);
      Alert.alert("Error", "Failed to log out. Please try again.");
    }
  };

  const renderPatientItem = ({ item }) => (
    <TouchableOpacity
      style={styles.patientCard}
      onPress={() => handlePatientSelect(item)}
    >
      <View style={styles.patientIconContainer}>
        <Ionicons name="person" size={24} color="#4f46e5" />
      </View>
      <View style={styles.patientDetails}>
        <Text style={styles.patientName}>{item.firstName} {item.lastName}</Text>
        <Text style={styles.patientEmail}>{item.email}</Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#6B7280" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Physiotherapist Dashboard</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#4f46e5" />
        </TouchableOpacity>
      </View>

      {userDetails && (
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText}>
            Welcome, {userDetails.firstName} {userDetails.lastName}
          </Text>
        </View>
      )}

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>
          My Patients {patientsList.length ? `(${patientsList.length})` : ''}
        </Text>
        
        {loading ? (
          <ActivityIndicator size="large" color="#4f46e5" style={styles.loader} />
        ) : patientsList.length ? (
          <FlatList
            data={patientsList}
            keyExtractor={i => i.id}
            renderItem={renderPatientItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.patientsList}
          />
        ) : (
          <View style={styles.emptyStateContainer}>
            <Ionicons name="people-outline" size={60} color="#E5E7EB" />
            <Text style={styles.noDataText}>No patients connected yet</Text>
          </View>
        )}
      </View>
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
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  logoutButton: {
    padding: 8,
  },
  welcomeContainer: {
    padding: 15,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    margin: 15,
  },
  welcomeText: {
    fontSize: 16,
    color: '#4338CA',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#374151',
  },
  patientsList: {
    paddingBottom: 20,
  },
  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  patientIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  patientDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  patientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  patientEmail: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 50,
  },
  noDataText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 15,
  },
  loader: {
    marginTop: 50,
  },
});